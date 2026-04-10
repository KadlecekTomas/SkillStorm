import type { Cache } from 'cache-manager';
import type { Prisma, OrganizationRole } from '@prisma/client';
import { SystemRole } from '@prisma/client';

type CacheInvalidationLogger = {
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

export const MAX_TTL_SECONDS = 15;
// The bypass flag must outlive every cached list entry. If invalidation fails,
// this guarantees all stale entries expire before any instance trusts cache again.
export const BYPASS_TTL_SECONDS = 60;

/**
 * Vytvoř “scope” pro cache klíče – superadmin = ALL, jinak orgId.
 */
export function cacheScopeForUser(
  systemRole?: SystemRole | null,
  orgId?: string | null,
) {
  return systemRole === SystemRole.SUPERADMIN ? 'ALL' : (orgId ?? 'UNKNOWN');
}

export function makeUserSearch(
  search?: string,
): Prisma.UserWhereInput | undefined {
  if (!search?.trim()) return undefined;
  const s = search.trim();
  return {
    OR: [
      { name: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { username: { contains: s, mode: 'insensitive' } },
    ],
  };
}

/**
 * Klíč verze listů pro daný scope (organizaci).
 * Při mutaci bumpni verzi a tím invaliduj všechno.
 */
export function orgVersionKey(scopeId: string) {
  return `org:ver:${scopeId}`;
}

export type CachedResource =
  | 'classrooms'
  | 'teachers'
  | 'students'
  | 'enrollments'
  | 'assignments'
  | 'dashboard';

export function resourceVersionKey(scopeId: string, resource: CachedResource) {
  return `org:ver:${scopeId}:${resource}`;
}

export function resourceBypassKey(scopeId: string, resource: CachedResource) {
  return `org:bypass:${scopeId}:${resource}`;
}

/**
 * Načti verzi pro scope (když není → 1).
 */
export async function getOrgVersion(cache: Cache, scopeId: string) {
  const v = await cache.get<number>(orgVersionKey(scopeId));
  return v ?? 1;
}

/**
 * Zvy̌š verzi pro scope – použij timestamp (vždy roste).
 * TTL verze = 0 (bez expirace).
 */
export async function bumpOrgVersion(cache: Cache, scopeId: string) {
  await cache.set(orgVersionKey(scopeId), Date.now(), 0);
}

export async function getResourceVersion(
  cache: Cache,
  scopeId: string,
  resource: CachedResource,
) {
  const v = await cache.get<number>(resourceVersionKey(scopeId, resource));
  return v ?? 1;
}

export async function bumpResourceVersion(
  cache: Cache,
  scopeId: string,
  resource: CachedResource,
) {
  await cache.set(resourceVersionKey(scopeId, resource), Date.now(), 0);
}

export async function bumpResourceVersions(
  cache: Cache,
  scopeId: string,
  resources: CachedResource[],
) {
  await Promise.all(resources.map((resource) => bumpResourceVersion(cache, scopeId, resource)));
}

function logInvalidationError(
  logger: CacheInvalidationLogger | undefined,
  message: string,
  meta: Record<string, unknown>,
) {
  if (logger?.error) {
    logger.error(message, meta);
    return;
  }
  console.error(message, meta);
}

export async function fallbackInvalidate(
  cache: Cache,
  opts: {
    scopeId: string;
    resources: CachedResource[];
    mutation: string;
    logger?: CacheInvalidationLogger;
    error: unknown;
  },
) {
  if (BYPASS_TTL_SECONDS <= MAX_TTL_SECONDS) {
    throw new Error('BYPASS_TTL_SECONDS must be greater than MAX_TTL_SECONDS.');
  }

  const operations = await Promise.allSettled([
    ...opts.resources.map((resource) =>
      cache.set(
        resourceBypassKey(opts.scopeId, resource),
        '1',
        { ttl: BYPASS_TTL_SECONDS } as never,
      ),
    ),
    cache.del(orgVersionKey(opts.scopeId)),
    ...opts.resources.map((resource) => cache.del(resourceVersionKey(opts.scopeId, resource))),
  ]);

  const failedOperations = operations
    .map((result, index) => ({ result, index }))
    .filter(
      (entry): entry is { result: PromiseRejectedResult; index: number } =>
        entry.result.status === 'rejected',
    )
    .map(({ result, index }) => ({
      key: (() => {
        if (index < opts.resources.length) {
          const resource = opts.resources[index] ?? opts.resources[opts.resources.length - 1]!;
          return resourceBypassKey(opts.scopeId, resource);
        }
        if (index === opts.resources.length) {
          return orgVersionKey(opts.scopeId);
        }
        const resource =
          opts.resources[index - opts.resources.length - 1] ??
          opts.resources[opts.resources.length - 1]!;
        return resourceVersionKey(opts.scopeId, resource);
      })(),
      error:
        result.reason instanceof Error ? result.reason.message : String(result.reason),
    }));

  logInvalidationError(opts.logger, 'Cache invalidation failed -> activating bypass', {
    mutation: opts.mutation,
    scopeId: opts.scopeId,
    resources: opts.resources,
    bypassTtlSeconds: BYPASS_TTL_SECONDS,
    error: opts.error instanceof Error ? opts.error.message : String(opts.error),
    failedOperations,
  });
}

export async function invalidateResourcesFailSafe(
  cache: Cache,
  opts: {
    scopeId: string;
    resources: CachedResource[];
    mutation: string;
    logger?: CacheInvalidationLogger;
  },
) {
  try {
    await bumpResourceVersions(cache, opts.scopeId, opts.resources);
    await Promise.all(
      opts.resources.map((resource) => cache.del(resourceBypassKey(opts.scopeId, resource))),
    );
  } catch (error) {
    await fallbackInvalidate(cache, {
      scopeId: opts.scopeId,
      resources: opts.resources,
      mutation: opts.mutation,
      error,
      ...(opts.logger ? { logger: opts.logger } : {}),
    });
  }
}

export function resetCacheFailSafeStateForTests() {
  // No-op: bypass state is now stored in the shared cache provider.
}

/**
 * Stabilní serializace objektu do části klíče.
 * - seřadí klíče abecedně
 * - stringifies bez whitespace
 */
export function stableStringify(obj: unknown): string {
  if (obj == null) return '';
  if (typeof obj !== 'object') return String(obj);
  const entries = Object.entries(obj as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

/**
 * Postav list klíč s verzí.
 * namespace = např. "subjects", "students", "teachers"
 */
export function buildVersionedListKey(opts: {
  namespace: string;
  scopeId: string; // 'ALL' nebo orgId
  version: number; // getOrgVersion(...)
  page?: number;
  limit?: number;
  search?: string;
  includeLevels?: boolean;
  order?: unknown; // libovolný popis orderBy
  filters?: unknown; // extra filtry (yearId, classSectionId, atd.)
  authz?: string; // authz scope (per-user)
}) {
  const p = opts.page ?? 1;
  const l = opts.limit ?? 20;
  const s = (opts.search ?? '').trim().toLowerCase();
  const inc = opts.includeLevels ? '1' : '0';
  const ord = stableStringify(opts.order);
  const fil = stableStringify(opts.filters);
  const authz = (opts.authz ?? '').trim();

  return [
    `${opts.namespace}:list`,
    `v${opts.version}`,
    `scope:${opts.scopeId}`,
    `p${p}`,
    `l${l}`,
    `q:${s}`,
    `lev:${inc}`,
    `ord:${ord}`,
    `f:${fil}`,
    `az:${authz}`,
  ].join(':');
}

export function buildAuthzScopeKey(opts: {
  userId: string;
  systemRole?: SystemRole | null;
  organizationRole?: OrganizationRole | null;
}) {
  const role = opts.organizationRole ?? opts.systemRole ?? 'none';
  return [
    `u:${opts.userId}`,
    `r:${role}`,
  ].join('|');
}

/**
 * Helper: get‑or‑set s TTL v ms.
 * fetcher: funkce, která vrátí payload při cache miss.
 */
export async function cacheGetOrSet<T>(
  cache: Cache,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  opts?: {
    scopeId?: string;
    resource?: CachedResource;
  },
): Promise<T> {
  if (opts?.scopeId && opts.resource) {
    try {
      const bypass = await cache.get(resourceBypassKey(opts.scopeId, opts.resource));
      if (bypass) {
        return fetcher();
      }
    } catch (error) {
      console.error('Cache bypass flag read failed; bypassing cache for request', {
        key,
        scopeId: opts.scopeId,
        resource: opts.resource,
        error: error instanceof Error ? error.message : String(error),
      });
      return fetcher();
    }
  }

  try {
    const hit = await cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
  } catch (error) {
    console.error('Cache read failed; bypassing cache for request', {
      key,
      scopeId: opts?.scopeId,
      resource: opts?.resource,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const fresh = await fetcher();
  try {
    await cache.set(key, fresh, ttlMs);
  } catch (error) {
    console.error('Cache write failed; continuing with fresh payload', {
      key,
      scopeId: opts?.scopeId,
      resource: opts?.resource,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return fresh;
}
