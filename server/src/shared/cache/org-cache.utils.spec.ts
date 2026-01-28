import { buildVersionedListKey, buildAuthzScopeKey } from './org-cache.utils';
import { OrganizationRole } from '@prisma/client';

describe('org-cache.utils', () => {
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
