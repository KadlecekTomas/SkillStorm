import 'reflect-metadata';
import { OrganizationRole, PermissionKey } from '@prisma/client';
import { RBAC_DEFAULT_PERMISSIONS } from '../rbac.defaults';
import { PERMISSION_KEY } from '../permission.decorator';
import { TestsController } from '@/tests/tests.controller';

function rolePermissions(role: OrganizationRole): PermissionKey[] {
  const defaults = RBAC_DEFAULT_PERMISSIONS[role];
  if (!defaults) return [];
  if (defaults === '*') return Object.values(PermissionKey);
  return defaults as PermissionKey[];
}

describe('RBAC defaults invariants', () => {
  it('TEACHER keeps required test permissions', () => {
    const teacher = rolePermissions(OrganizationRole.TEACHER);
    expect(teacher).toEqual(
      expect.arrayContaining([PermissionKey.CREATE_TEST, PermissionKey.EDIT_TEST]),
    );
  });

  it('DIRECTOR keeps required test permissions', () => {
    const director = rolePermissions(OrganizationRole.DIRECTOR);
    expect(director).toEqual(
      expect.arrayContaining([
        PermissionKey.CREATE_TEST,
        PermissionKey.EDIT_TEST,
        PermissionKey.DELETE_TEST,
      ]),
    );
  });

  it('OWNER keeps all test permissions', () => {
    const owner = rolePermissions(OrganizationRole.OWNER);
    expect(owner).toEqual(
      expect.arrayContaining([
        PermissionKey.CREATE_TEST,
        PermissionKey.EDIT_TEST,
        PermissionKey.DELETE_TEST,
      ]),
    );
  });
});

describe('Tests endpoint permission invariants', () => {
  const handlerPermissions = (
    method:
      | 'create'
      | 'update'
      | 'remove'
      | 'addQuestion'
      | 'updateQuestion'
      | 'removeQuestion',
  ): PermissionKey[] => {
    const proto = TestsController.prototype;
    return Reflect.getMetadata(PERMISSION_KEY, proto[method]) as PermissionKey[];
  };

  it('uses CREATE_TEST for creating tests', () => {
    expect(handlerPermissions('create')).toEqual([PermissionKey.CREATE_TEST]);
  });

  it('uses EDIT_TEST for editing tests/questions', () => {
    expect(handlerPermissions('update')).toEqual([PermissionKey.EDIT_TEST]);
    expect(handlerPermissions('addQuestion')).toEqual([PermissionKey.EDIT_TEST]);
    expect(handlerPermissions('updateQuestion')).toEqual([PermissionKey.EDIT_TEST]);
    expect(handlerPermissions('removeQuestion')).toEqual([PermissionKey.EDIT_TEST]);
  });

  it('uses DELETE_TEST for deleting tests', () => {
    expect(handlerPermissions('remove')).toEqual([PermissionKey.DELETE_TEST]);
  });
});
