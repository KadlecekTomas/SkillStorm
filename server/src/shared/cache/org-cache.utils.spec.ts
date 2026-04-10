import {
  BYPASS_TTL_SECONDS,
  MAX_TTL_SECONDS,
  buildVersionedListKey,
  buildAuthzScopeKey,
  cacheGetOrSet,
  fallbackInvalidate,
  invalidateResourcesFailSafe,
  resourceBypassKey,
  resetCacheFailSafeStateForTests,
} from './org-cache.utils';
import { OrganizationRole, SystemRole } from '@prisma/client';
import type { Cache } from 'cache-manager';

type CacheEntry = {
  value: unknown;
  expiresAt: number | null;
};

function createFakeCache() {
  const store = new Map<string, CacheEntry>();
  const cache = {
    get: jest.fn(async <T>(key: string) => {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value as T;
    }),
    set: jest.fn(async (key: string, value: unknown, ttl?: number | { ttl?: number }) => {
      const ttlSeconds =
        typeof ttl === 'number'
          ? ttl
          : typeof ttl?.ttl === 'number'
            ? ttl.ttl * 1000
            : undefined;
      store.set(key, {
        value,
        expiresAt:
          typeof ttlSeconds === 'number' && ttlSeconds > 0
            ? Date.now() + ttlSeconds
            : null,
      });
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as Cache;

  return { cache, store };
}

describe('org-cache.utils', () => {
  beforeEach(() => {
    resetCacheFailSafeStateForTests();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('buildAuthzScopeKey', () => {
    it('is a function', () => {
      expect(typeof buildAuthzScopeKey).toBe('function');
    });

    it('returns deterministic key for same input', () => {
      const opts = {
        userId: 'u-1',
        systemRole: SystemRole.SUPERADMIN,
        organizationRole: null,
      };
      expect(buildAuthzScopeKey(opts)).toBe(buildAuthzScopeKey(opts));
    });

    it('key contains userId and role', () => {
      const key = buildAuthzScopeKey({
        userId: 'usr-abc',
        organizationRole: OrganizationRole.TEACHER,
      });
      expect(key).toContain('usr-abc');
      expect(key).toContain('TEACHER');
      expect(key).toMatch(/^u:.+[|]r:.+$/);
    });
  });

  it('includes per-user authz scope in cache key', () => {
    const base = {
      namespace: 'classSections',
      scopeId: 'org-1',
      version: 1,
      page: 1,
      limit: 50,
      search: '',
      order: [{ grade: 'asc' }],
      filters: { yearId: 'year-1' },
    };

    const authzA = buildAuthzScopeKey({
      userId: 'user-1',
      systemRole: null,
      organizationRole: OrganizationRole.DIRECTOR,
    });

    const authzB = buildAuthzScopeKey({
      userId: 'user-2',
      systemRole: null,
      organizationRole: OrganizationRole.STUDENT,
    });

    const keyA = buildVersionedListKey({ ...base, authz: authzA });
    const keyB = buildVersionedListKey({ ...base, authz: authzB });

    expect(keyA).not.toEqual(keyB);
  });

  it('defines bypass TTL greater than max cache TTL', () => {
    expect(BYPASS_TTL_SECONDS).toBeGreaterThan(MAX_TTL_SECONDS);
  });

  it('invalidation failure sets distributed bypass flag', async () => {
    const { cache } = createFakeCache();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(cache, 'set').mockRejectedValue(new Error('cache unavailable'));

    await invalidateResourcesFailSafe(cache, {
      scopeId: 'org-1',
      resources: ['classrooms', 'dashboard'],
      mutation: 'classrooms.create',
    });

    expect(console.error).toHaveBeenCalledWith(
      'Cache invalidation failed -> activating bypass',
      expect.objectContaining({
        mutation: 'classrooms.create',
        scopeId: 'org-1',
        resources: ['classrooms', 'dashboard'],
        bypassTtlSeconds: BYPASS_TTL_SECONDS,
      }),
    );
  });

  it('fallback invalidation sets distributed bypass flags', async () => {
    const { cache, store } = createFakeCache();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await fallbackInvalidate(cache, {
      scopeId: 'org-1',
      resources: ['classrooms', 'dashboard'],
      mutation: 'classrooms.update',
      error: new Error('version bump failed'),
    });

    expect(store.get(resourceBypassKey('org-1', 'classrooms'))?.value).toBe('1');
    expect(store.get(resourceBypassKey('org-1', 'dashboard'))?.value).toBe('1');
  });

  it('read path respects bypass flag and skips cache', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-10T10:00:00.000Z'));
    const { cache } = createFakeCache();
    const fetcher = jest.fn(async () => ({ source: 'fresh' }));

    await cache.set('classrooms:list:test', { source: 'stale' }, 10_000);
    await cache.set(
      resourceBypassKey('org-1', 'classrooms'),
      '1',
      { ttl: BYPASS_TTL_SECONDS } as never,
    );

    const result = await cacheGetOrSet(
      cache,
      'classrooms:list:test',
      10_000,
      fetcher,
      { scopeId: 'org-1', resource: 'classrooms' },
    );

    expect(result).toEqual({ source: 'fresh' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('after bypass TTL expires, cache is used again', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-10T10:00:00.000Z'));
    const { cache } = createFakeCache();
    const firstFetcher = jest.fn(async () => ({ source: 'fresh' }));
    const secondFetcher = jest.fn(async () => ({ source: 'should-not-run' }));
    await cache.set(
      resourceBypassKey('org-1', 'students'),
      '1',
      { ttl: BYPASS_TTL_SECONDS } as never,
    );

    await expect(
      cacheGetOrSet(
        cache,
        'students:list:test',
        10_000,
        firstFetcher,
        { scopeId: 'org-1', resource: 'students' },
      ),
    ).resolves.toEqual({ source: 'fresh' });

    jest.advanceTimersByTime(BYPASS_TTL_SECONDS * 1000 + 1);
    await cache.set('students:list:test', { source: 'cached-after-bypass' }, 10_000);
    await expect(
      cacheGetOrSet(
        cache,
        'students:list:test',
        10_000,
        secondFetcher,
        { scopeId: 'org-1', resource: 'students' },
      ),
    ).resolves.toEqual({ source: 'cached-after-bypass' });

    expect(firstFetcher).toHaveBeenCalledTimes(1);
    expect(secondFetcher).not.toHaveBeenCalled();
  });
});
