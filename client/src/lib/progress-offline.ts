import type {
  CreateProgressEntryInput,
  ProgressContext,
} from '@/lib/progress-api';

const DB_NAME = 'skillstorm-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'progress-queue';
const CACHE_STORE = 'progress-cache';
const CONTEXT_TTL_MS = 12 * 60 * 60 * 1000;

export type ProgressOfflineScope = string;

type QueuedProgressEntry = CreateProgressEntryInput & {
  clientMutationId: string;
  queuedAt: number;
  scopeKey: ProgressOfflineScope;
};

type CachedContext = {
  key: string;
  scopeKey: ProgressOfflineScope;
  value: ProgressContext;
  expiresAt: number;
};

export function buildProgressOfflineScope(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
): ProgressOfflineScope | null {
  if (!userId || !organizationId) return null;
  return `progress:${userId}:${organizationId}`;
}

const contextKey = (scopeKey: ProgressOfflineScope): string =>
  `${scopeKey}:context`;

function toSyncEntry(row: QueuedProgressEntry): CreateProgressEntryInput {
  const { queuedAt, scopeKey, ...entry } = row;
  void queuedAt;
  void scopeKey;
  return entry;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'clientMutationId' });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = run(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function cacheProgressContext(
  scopeKey: ProgressOfflineScope,
  value: ProgressContext,
): Promise<void> {
  const record: CachedContext = {
    key: contextKey(scopeKey),
    scopeKey,
    value,
    expiresAt: Date.now() + CONTEXT_TTL_MS,
  };
  await withStore<IDBValidKey>(CACHE_STORE, 'readwrite', (store) =>
    store.put(record),
  );
}

export async function readCachedProgressContext(
  scopeKey: ProgressOfflineScope,
): Promise<ProgressContext | null> {
  const key = contextKey(scopeKey);
  const record = await withStore<CachedContext>(CACHE_STORE, 'readonly', (store) =>
    store.get(key),
  );
  if (!record || record.scopeKey !== scopeKey) return null;
  if (record.expiresAt <= Date.now()) {
    await withStore<undefined>(CACHE_STORE, 'readwrite', (store) =>
      store.delete(key),
    );
    return null;
  }
  return record.value;
}

export async function queueProgressEntry(
  scopeKey: ProgressOfflineScope,
  input: CreateProgressEntryInput,
): Promise<QueuedProgressEntry> {
  const queued: QueuedProgressEntry = {
    ...input,
    clientMutationId: input.clientMutationId ?? crypto.randomUUID(),
    queuedAt: Date.now(),
    scopeKey,
  };
  const result = await withStore<IDBValidKey>(QUEUE_STORE, 'readwrite', (store) =>
    store.put(queued),
  );
  if (result === null) {
    throw new Error('OFFLINE_STORAGE_UNAVAILABLE');
  }
  return queued;
}

export async function listQueuedProgressEntries(
  scopeKey: ProgressOfflineScope,
): Promise<CreateProgressEntryInput[]> {
  const rows = await withStore<QueuedProgressEntry[]>(
    QUEUE_STORE,
    'readonly',
    (store) => store.getAll(),
  );
  return (rows ?? [])
    .filter((row) => row.scopeKey === scopeKey)
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .map(toSyncEntry);
}

export async function removeQueuedProgressEntries(
  scopeKey: ProgressOfflineScope,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      for (const id of ids) {
        const request = store.get(id);
        request.onsuccess = () => {
          const row = request.result as QueuedProgressEntry | undefined;
          if (row?.scopeKey === scopeKey) store.delete(id);
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearProgressOfflineScope(
  scopeKey: ProgressOfflineScope,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([QUEUE_STORE, CACHE_STORE], 'readwrite');
      const queue = tx.objectStore(QUEUE_STORE);
      const cache = tx.objectStore(CACHE_STORE);
      const queueRequest = queue.getAll();
      queueRequest.onsuccess = () => {
        for (const row of queueRequest.result as QueuedProgressEntry[]) {
          if (row.scopeKey === scopeKey) queue.delete(row.clientMutationId);
        }
      };
      cache.delete(contextKey(scopeKey));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Hard privacy boundary for logout/shared devices. This removes every local
 * progress scope, including legacy unscoped records from older app versions.
 */
export async function clearProgressOfflineData(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  await new Promise<void>((resolve) => {
    const request = window.indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
