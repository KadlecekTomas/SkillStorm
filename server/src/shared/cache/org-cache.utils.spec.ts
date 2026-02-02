import { buildVersionedListKey, buildAuthzScopeKey } from './org-cache.utils';
import { OrganizationRole, SystemRole } from '@prisma/client';

describe('org-cache.utils', () => {
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
});
