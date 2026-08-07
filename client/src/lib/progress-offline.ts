import type {
  CreateProgressEntryInput,
  ProgressContext,
} from '@/lib/progress-api';

const DB_NAME = 'skillstorm-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'progress-queue';
const CACHE_STORE = 'progress-cache';
const CONTEXT_KEY = 'progress-context';
const CONTEXT_TTL_MS = 12 * 60 * 60 * 1000;

type QueuedProgressEntry = CreateProgressEntryInput & {
  clientMutationId: string;
  queuedAt: number;
};

type CachedContext = {
  key: typeof CONTEXT_KEY;
  value: ProgressContext;
  expiresAt: number;
};

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

export async function cacheProgressContext(value: ProgressContext): Promise<void> {
  const record: CachedContext = {
    key: CONTEXT_KEY,
    value,
    expiresAt: Date.now() + CONTEXT_TTL_MS,
  };
  await withStore(CACHE_STORE, 'readwrite', (store) => store.put(record));
}

export async function readCachedProgressContext(): Promise<ProgressContext | null> {
  const record = await withStore<CachedContext>(CACHE_STORE, 'readonly', (store) =>
    store.get(CONTEXT_KEY),
  );
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    await withStore(CACHE_STORE, 'readwrite', (store) => store.delete(CONTEXT_KEY));
    return null;
  }
  return record.value;
}

export async function queueProgressEntry(
  input: CreateProgressEntryInput,
): Promise<QueuedProgressEntry> {
  const queued: QueuedProgressEntry = {
    ...input,
    clientMutationId: input.clientMutationId ?? crypto.randomUUID(),
    queuedAt: Date.now(),
  };
  const result = await withStore<QueuedProgressEntry>(QUEUE_STORE, 'readwrite', (store) =>
    store.put(queued),
  );
  if (result === null) {
    throw new Error('OFFLINE_STORAGE_UNAVAILABLE');
  }
  return queued;
}

export async function listQueuedProgressEntries(): Promise<QueuedProgressEntry[]> {
  const rows = await withStore<QueuedProgressEntry[]>(QUEUE_STORE, 'readonly', (store) =>
    store.getAll(),
  );
  return (rows ?? []).sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function removeQueuedProgressEntries(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Maže lokální školní data při odhlášení / výměně účtu. Volající může tuto
 * funkci připojit k existujícímu logout flow; bezpečně funguje i bez IndexedDB.
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
