export type { SystemRole, OrganizationRole } from "./permissions";
export { PermissionKey } from "./permissions";
import type { PermissionKey } from "./permissions";

export type PublishStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type ContentType =
  | "MATERIAL"
  | "PRACTICE"
  | "TEST"
  | "VIDEO"
  | "LINK";

export type ContentScope = "GLOBAL" | "ORGANIZATION" | "SHARED";

export type Classroom = {
  id: string;
  label?: string | null;
  grade: string;
  section: string;
  gradeLabel?: string | null;
  teacherName?: string | null;
  teacherEmail?: string | null;
  studentsCount: number;
  updatedAt?: string | null;
};

export type TestSummary = {
  id: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  status: PublishStatus;
  version: number;
  completionRate: number;
  submissions: number;
  avgScore: number;
};

export type ContentItem = {
  id: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  contentType: ContentType;
  scope: ContentScope;
  educationLevel?: string | null;
  schoolGrade?: string | null;
  updatedAt?: string | null;
};

export type ResultInsight = {
  id: string;
  label: string;
  value: string | number;
  trend: "up" | "down";
};

export type User = {
  id: string;
  email?: string | null;
  username?: string | null;
  name: string;
  fullName?: string | null;
  systemRole?: SystemRole | null;
  organizationRole?: OrganizationRole | null;
  organizationId?: string | null;
  lastLoginAt?: string | null;
  avatarUrl?: string | null;
  permissions?: PermissionKey[];
};
