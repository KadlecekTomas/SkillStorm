export type SystemRole = "SUPERADMIN" | "DEVOPS" | "SUPPORT";

export type OrganizationRole =
  | "OWNER"
  | "DIRECTOR"
  | "TEACHER"
  | "STUDENT"
  | "PARENT";

export enum PermissionKey {
  CREATE_TEST = "CREATE_TEST",
  EDIT_TEST = "EDIT_TEST",
  DELETE_TEST = "DELETE_TEST",
  VIEW_RESULTS = "VIEW_RESULTS",
  MANAGE_STUDENTS = "MANAGE_STUDENTS",
  MANAGE_TEACHERS = "MANAGE_TEACHERS",
  VIEW_ANALYTICS = "VIEW_ANALYTICS",
  INVITE_STUDENTS = "INVITE_STUDENTS",
  INVITE_TEACHERS = "INVITE_TEACHERS",
  /** Refined: see docs/PERMISSION_MATRIX_REFINEMENT.md */
  VIEW_TEST_OVERVIEW = "VIEW_TEST_OVERVIEW",
  MANAGE_TESTS = "MANAGE_TESTS",
  ASSIGN_TESTS = "ASSIGN_TESTS",
  VIEW_SUBMISSIONS = "VIEW_SUBMISSIONS",
  MANAGE_ASSIGNMENTS = "MANAGE_ASSIGNMENTS",
  VIEW_OWN_ASSIGNMENTS = "VIEW_OWN_ASSIGNMENTS",
  VIEW_CLASS_ASSIGNMENTS = "VIEW_CLASS_ASSIGNMENTS",
  VIEW_ORG_ASSIGNMENTS = "VIEW_ORG_ASSIGNMENTS",
}

/**
 * Documentation/test fallback only. Runtime authorization MUST use the
 * effective `permissions` returned by `/auth/me`; see derivePermissions().
 * Keep this matrix aligned with server/src/modules/rbac/rbac.defaults.ts.
 */
export const ROLE_PERMISSION_MATRIX: Record<
  OrganizationRole,
  PermissionKey[]
> = {
  OWNER: Object.values(PermissionKey),
  DIRECTOR: [
    PermissionKey.CREATE_TEST,
    PermissionKey.EDIT_TEST,
    PermissionKey.DELETE_TEST,
    PermissionKey.VIEW_RESULTS,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
    PermissionKey.VIEW_ANALYTICS,
    PermissionKey.INVITE_STUDENTS,
    PermissionKey.INVITE_TEACHERS,
    PermissionKey.VIEW_TEST_OVERVIEW,
    PermissionKey.MANAGE_TESTS,
    PermissionKey.ASSIGN_TESTS,
    PermissionKey.VIEW_SUBMISSIONS,
    PermissionKey.MANAGE_ASSIGNMENTS,
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
    PermissionKey.VIEW_CLASS_ASSIGNMENTS,
    PermissionKey.VIEW_ORG_ASSIGNMENTS,
  ],
  TEACHER: [
    PermissionKey.CREATE_TEST,
    PermissionKey.EDIT_TEST,
    PermissionKey.VIEW_RESULTS,
    PermissionKey.VIEW_ANALYTICS,
    PermissionKey.INVITE_STUDENTS,
    PermissionKey.VIEW_TEST_OVERVIEW,
    PermissionKey.MANAGE_TESTS,
    PermissionKey.ASSIGN_TESTS,
    PermissionKey.VIEW_SUBMISSIONS,
    PermissionKey.VIEW_CLASS_ASSIGNMENTS,
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
  ],
  STUDENT: [
    PermissionKey.VIEW_RESULTS,
    PermissionKey.VIEW_TEST_OVERVIEW,
    PermissionKey.VIEW_SUBMISSIONS,
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
  ],
  // Guardian access is relationship-scoped on the server. A parent must never
  // inherit generic school permissions from a static client matrix.
  PARENT: [],
};

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, PermissionKey[]> = {
  SUPERADMIN: Object.values(PermissionKey),
  DEVOPS: [
    PermissionKey.VIEW_RESULTS,
    PermissionKey.MANAGE_TEACHERS,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.INVITE_STUDENTS,
    PermissionKey.INVITE_TEACHERS,
  ],
  SUPPORT: [PermissionKey.VIEW_RESULTS],
};

/**
 * Role landing must always be a route that the role can render successfully.
 * Role-specific modules are reached from the dashboard navigation afterwards.
 */
export const roleHome: Record<OrganizationRole | "DEFAULT", string> = {
  OWNER: "/app",
  DIRECTOR: "/app",
  TEACHER: "/app",
  STUDENT: "/app",
  PARENT: "/app/family",
  DEFAULT: "/app",
};
