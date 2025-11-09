import { OrganizationRole, PermissionKey } from '@prisma/client';

type RolePermissionMatrix = Record<
  OrganizationRole,
  {
    permissions: Array<PermissionKey> | ['*'];
    endpoints: string[];
    notes?: string[];
  }
>;

export const PERMISSION_ENDPOINTS: Record<PermissionKey, string[]> = {
  [PermissionKey.CREATE_TEST]: ['POST /tests', 'POST /tests/:id/questions'],
  [PermissionKey.EDIT_TEST]: ['PATCH /tests/:id', 'PATCH /tests/:id/questions'],
  [PermissionKey.DELETE_TEST]: ['DELETE /tests/:id'],
  [PermissionKey.VIEW_RESULTS]: ['GET /tests', 'GET /tests/:id', 'GET /submissions', 'GET /results/:classId'],
  [PermissionKey.MANAGE_STUDENTS]: ['POST /submissions', 'PATCH /submissions/:id/responses'],
  [PermissionKey.MANAGE_TEACHERS]: ['PATCH /teachers/:id', 'POST /teachers'],
  [PermissionKey.VIEW_ANALYTICS]: ['GET /analytics/**'],
};

export const RBAC: RolePermissionMatrix = {
  [OrganizationRole.OWNER]: {
    permissions: ['*'],
    endpoints: ['*'],
    notes: ['Full organizational control'],
  },
  [OrganizationRole.DIRECTOR]: {
    permissions: [
      PermissionKey.MANAGE_TEACHERS,
      PermissionKey.MANAGE_STUDENTS,
      PermissionKey.VIEW_RESULTS,
      PermissionKey.VIEW_ANALYTICS,
    ],
    endpoints: [
      ...PERMISSION_ENDPOINTS[PermissionKey.MANAGE_TEACHERS],
      ...PERMISSION_ENDPOINTS[PermissionKey.MANAGE_STUDENTS],
      ...PERMISSION_ENDPOINTS[PermissionKey.VIEW_RESULTS],
    ],
    notes: ['School leadership (teachers/students management, reporting)'],
  },
  [OrganizationRole.TEACHER]: {
    permissions: [
      PermissionKey.CREATE_TEST,
      PermissionKey.EDIT_TEST,
      PermissionKey.VIEW_RESULTS,
    ],
    endpoints: [
      ...PERMISSION_ENDPOINTS[PermissionKey.CREATE_TEST],
      ...PERMISSION_ENDPOINTS[PermissionKey.EDIT_TEST],
      ...PERMISSION_ENDPOINTS[PermissionKey.VIEW_RESULTS],
    ],
    notes: ['Authors can build and review tests, but cannot delete others by default'],
  },
  [OrganizationRole.STUDENT]: {
    permissions: [PermissionKey.VIEW_RESULTS],
    endpoints: PERMISSION_ENDPOINTS[PermissionKey.VIEW_RESULTS],
    notes: ['Students are limited to their own progress visibility'],
  },
  [OrganizationRole.PARENT]: {
    permissions: [PermissionKey.VIEW_RESULTS],
    endpoints: PERMISSION_ENDPOINTS[PermissionKey.VIEW_RESULTS],
    notes: ['Read-only access focused on student performance'],
  },
};
