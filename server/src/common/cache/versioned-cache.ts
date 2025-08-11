import type { Cache } from 'cache-manager';

export type ScopeId = string;
export const GLOBAL_SCOPE = 'GLOBAL:ALL';

export function versionKey(scopeId: ScopeId) {
  return `ver:${scopeId}`;
}
export async function getVersion(cache: Cache, scopeId: ScopeId) {
  const v = await cache.get<number>(versionKey(scopeId));
  return v ?? 1;
}
export async function bumpVersion(cache: Cache, scopeId: ScopeId) {
  await cache.set(versionKey(scopeId), Date.now(), 0);
}
export async function bumpMany(cache: Cache, scopeIds: ScopeId[]) {
  await Promise.all(scopeIds.map((s) => bumpVersion(cache, s)));
}

export function stableStringify(obj: unknown): string {
  if (obj == null) return '';
  if (typeof obj !== 'object') return String(obj);
  const entries = Object.entries(obj as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

export function listKey(opts: {
  ns: string;
  scope: ScopeId;
  ver: number;
  page?: number;
  limit?: number;
  search?: string;
  order?: unknown;
  filters?: unknown;
}) {
  const p = opts.page ?? 1;
  const l = opts.limit ?? 20;
  const s = (opts.search ?? '').trim().toLowerCase();
  return [
    `${opts.ns}:list`,
    `v${opts.ver}`,
    `scope:${opts.scope}`,
    `p${p}`,
    `l${l}`,
    `q:${s}`,
    `ord:${stableStringify(opts.order)}`,
    `f:${stableStringify(opts.filters)}`,
  ].join(':');
}

export function detailKey(opts: {
  ns: string;
  id: string;
  scope: ScopeId;
  ver: number;
}) {
  return `${opts.ns}:detail:v${opts.ver}:scope:${opts.scope}:id:${opts.id}`;
}

export async function cacheGetOrSet<T>(
  cache: Cache,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
) {
  const hit = await cache.get<T>(key);
  if (hit !== undefined && hit !== null) return hit;
  const fresh = await fetcher();
  await cache.set(key, fresh, ttlMs);
  return fresh;
}

// Convenience
export async function versionedList<T>(
  cache: Cache,
  ns: string,
  scope: ScopeId,
  ttlMs: number,
  args: {
    page?: number;
    limit?: number;
    search?: string;
    order?: unknown;
    filters?: unknown;
  },
  fetcher: () => Promise<T>,
) {
  const ver = await getVersion(cache, scope);
  const key = listKey({ ns, scope, ver, ...args });
  return cacheGetOrSet(cache, key, ttlMs, fetcher);
}

export async function versionedDetail<T>(
  cache: Cache,
  ns: string,
  id: string,
  scope: ScopeId,
  ttlMs: number,
  fetcher: () => Promise<T>,
) {
  const ver = await getVersion(cache, scope);
  const key = detailKey({ ns, id, scope, ver });
  return cacheGetOrSet(cache, key, ttlMs, fetcher);
}
