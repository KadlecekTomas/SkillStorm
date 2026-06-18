import {
  DEFAULT_DIRECTOR_GROUP_PATTERNS,
  DEFAULT_TEACHER_GROUP_PATTERNS,
  ORG_UNIT_STUDENT_FRAGMENTS,
  ORG_UNIT_TEACHER_FRAGMENTS,
} from '@/integrations/google-workspace/google-workspace.constants';
import { emailLocalPart, normalizeText } from './normalize';

/** Roles the onboarding flow can assign. Maps to OrganizationRole at commit. */
export type DetectedRole = 'STUDENT' | 'TEACHER' | 'DIRECTOR';

/** DIRECTOR > TEACHER > STUDENT. Higher number wins on conflict. */
const ROLE_PRIORITY: Record<DetectedRole, number> = {
  STUDENT: 1,
  TEACHER: 2,
  DIRECTOR: 3,
};

export interface RolePatterns {
  teacherGroupPatterns: readonly string[];
  directorGroupPatterns: readonly string[];
}

const DEFAULT_PATTERNS: RolePatterns = {
  teacherGroupPatterns: DEFAULT_TEACHER_GROUP_PATTERNS,
  directorGroupPatterns: DEFAULT_DIRECTOR_GROUP_PATTERNS,
};

function matchesAny(haystacks: string[], needles: readonly string[]): boolean {
  return needles.some((needle) => {
    const n = normalizeText(needle);
    return n.length > 0 && haystacks.some((h) => h.includes(n));
  });
}

/**
 * Classify a whole Google group as a role source. Director patterns are
 * checked first (highest priority). Returns null when the group is not a
 * role-defining group (e.g. it is a class group, or unresolved).
 */
export function detectGroupRole(
  group: { email?: string | null; name?: string | null },
  patterns: RolePatterns = DEFAULT_PATTERNS,
): DetectedRole | null {
  const haystacks = [
    emailLocalPart(group.email),
    normalizeText(group.name ?? ''),
  ].filter(Boolean);
  if (haystacks.length === 0) return null;

  if (matchesAny(haystacks, patterns.directorGroupPatterns)) return 'DIRECTOR';
  if (matchesAny(haystacks, patterns.teacherGroupPatterns)) return 'TEACHER';
  return null;
}

/** Classify a user's org-unit path into a role, or null if it carries no signal. */
export function detectOrgUnitRole(
  orgUnitPath: string | null | undefined,
): DetectedRole | null {
  if (!orgUnitPath) return null;
  const path = normalizeText(orgUnitPath);
  if (ORG_UNIT_TEACHER_FRAGMENTS.some((f) => path.includes(f)))
    return 'TEACHER';
  if (ORG_UNIT_STUDENT_FRAGMENTS.some((f) => path.includes(f)))
    return 'STUDENT';
  return null;
}

export interface RoleResolution {
  role: DetectedRole;
  /** True when at least two distinct roles were proposed for the same user. */
  conflict: boolean;
  /** All distinct roles seen, for the ROLE_CONFLICT issue payload. */
  candidates: DetectedRole[];
}

/**
 * Resolve a final role from all signals collected for a single user, applying
 * DIRECTOR > TEACHER > STUDENT. Returns whether the inputs disagreed so the
 * caller can emit a ROLE_CONFLICT warning (without failing the import).
 */
export function resolveRole(candidates: DetectedRole[]): RoleResolution | null {
  const distinct = Array.from(new Set(candidates));
  if (distinct.length === 0) return null;

  const winner = distinct.reduce((best, current) =>
    ROLE_PRIORITY[current] > ROLE_PRIORITY[best] ? current : best,
  );

  return {
    role: winner,
    conflict: distinct.length > 1,
    candidates: distinct.sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a]),
  };
}

export { ROLE_PRIORITY };
