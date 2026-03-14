export type { SystemRole, OrganizationRole } from "./permissions";
export { PermissionKey } from "./permissions";
import type {
  PermissionKey,
  SystemRole,
  OrganizationRole,
} from "./permissions";

export type PublishStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type OrganizationType = "SCHOOL" | "PRIVATE" | "COMMUNITY";

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

export type AcademicYear = {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
};

export type OrgSubjectOption = {
  id: string;
  organizationId: string;
  isEnabled: boolean;
  isCustom: boolean;
  subject: {
    id: string;
    name: string;
    gradeFrom: number;
    gradeTo: number;
  };
};

export type OrgSubject = OrgSubjectOption;

/** SubjectLevel — grade enablement record for a Subject. */
export type SubjectLevel = {
  id: string;
  subjectId: string;
  grade: string;
  isEnabled: boolean;
  order: number | null;
  label: string | null;
};

/** Curriculum-linked subject (Subject model, not OrgSubject). */
export type Subject = {
  id: string;
  name: string;
  catalogSubjectId: string | null;
  catalogSubject: { id: string; code: string; name: string } | null;
  deletedAt: string | null;
  gradeFrom?: number;
  gradeTo?: number;
  /** Populated when fetched with ?includeLevels=true */
  levels?: SubjectLevel[];
};

export type TestSummary = {
  id: string;
  title: string;
  description?: string | null;
  subject?: Subject | null;
  allowedGrades: string[];
  status: PublishStatus;
  version: number;
  /** null when no submissions exist yet */
  completionRate: number | null;
  /** null when no submissions exist yet */
  submissions: number | null;
  /** null when no submissions exist yet */
  avgScore: number | null;
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

export type OrganizationStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export type AuthContextMode = "platform" | "organization" | "personal";

export type AuthContext = {
  mode: AuthContextMode;
  organizationId: string | null;
};

export type MembershipSummary = {
  id: string;
  organizationId: string;
  role: OrganizationRole;
  organization?: {
    name: string;
    type: OrganizationType;
    status?: OrganizationStatus;
  };
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
  memberships?: MembershipSummary[];
  needsOnboarding?: boolean;
  isPlatformAdmin?: boolean;
};
