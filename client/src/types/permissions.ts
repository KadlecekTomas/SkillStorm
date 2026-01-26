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
}

export const ROLE_PERMISSION_MATRIX: Record<
  OrganizationRole,
  PermissionKey[]
> = {
  OWNER: Object.values(PermissionKey),
  DIRECTOR: Object.values(PermissionKey),
  TEACHER: [
    PermissionKey.CREATE_TEST,
    PermissionKey.EDIT_TEST,
    PermissionKey.VIEW_RESULTS,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.INVITE_STUDENTS,
  ],
  STUDENT: [PermissionKey.VIEW_RESULTS],
  PARENT: [PermissionKey.VIEW_RESULTS],
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

export const roleHome: Record<OrganizationRole | "DEFAULT", string> = {
  OWNER: "/dashboard/settings",
  DIRECTOR: "/dashboard/settings",
  TEACHER: "/dashboard/tests",
  STUDENT: "/dashboard/results",
  PARENT: "/dashboard/results",
  DEFAULT: "/dashboard",
};
