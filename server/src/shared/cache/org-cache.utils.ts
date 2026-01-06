import type { Cache } from 'cache-manager';
import type { Prisma } from '@prisma/client';
import { SystemRole } from '@prisma/client';

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
}) {
  const p = opts.page ?? 1;
  const l = opts.limit ?? 20;
  const s = (opts.search ?? '').trim().toLowerCase();
  const inc = opts.includeLevels ? '1' : '0';
  const ord = stableStringify(opts.order);
  const fil = stableStringify(opts.filters);

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
  ].join(':');
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
): Promise<T> {
  const hit = await cache.get<T>(key);
  if (hit !== undefined && hit !== null) return hit;
  const fresh = await fetcher();
  await cache.set(key, fresh, ttlMs);
  return fresh;
}
