import type { PrismaService } from '@/prisma/prisma.service';

/**
 * Organization Readiness v2 – derived state machine.
 * State is computed from DB; never stored.
 * "Current" year = AcademicYear where isCurrent=true (at most one per org).
 */
export enum OrgReadinessState {
  /** No current academic year */
  R0_EMPTY = 'R0_EMPTY',
  /** Current year exists, no class section in that year */
  R1_YEAR_READY = 'R1_YEAR_READY',
  /** Current year + at least one class section (can run assignments) */
  R2_STRUCTURE_READY = 'R2_STRUCTURE_READY',
  /** Optional: at least one assignment in current year */
  R3_EXECUTION_READY = 'R3_EXECUTION_READY',
}

export type OrgReadinessEvidence = {
  hasCurrentYear: boolean;
  hasClassSectionInCurrentYear: boolean;
  hasAssignmentInCurrentYear: boolean;
};

export type DerivedOrgReadiness = {
  state: OrgReadinessState;
  canExecute: boolean;
  missing: string[];
  evidence: OrgReadinessEvidence;
  currentYearId: string | null;
};

const MISSING_CURRENT_ACADEMIC_YEAR = 'missing_current_academic_year';
const MISSING_CLASS_SECTION_IN_CURRENT_YEAR = 'missing_class_section_in_current_year';
const MISSING_ASSIGNMENT_IN_CURRENT_YEAR = 'missing_assignment_in_current_year';

/**
 * Derive organization readiness from DB.
 * canExecute === true when state >= R2_STRUCTURE_READY (required for assignments/submissions).
 * Uses the single current academic year per org (isCurrent=true).
 */
export async function deriveOrgReadiness(
  prisma: PrismaService,
  orgId: string | null,
): Promise<DerivedOrgReadiness> {
  const empty: DerivedOrgReadiness = {
    state: OrgReadinessState.R0_EMPTY,
    canExecute: false,
    missing: [MISSING_CURRENT_ACADEMIC_YEAR, MISSING_CLASS_SECTION_IN_CURRENT_YEAR],
    evidence: {
      hasCurrentYear: false,
      hasClassSectionInCurrentYear: false,
      hasAssignmentInCurrentYear: false,
    },
    currentYearId: null,
  };

  if (!orgId) return empty;

  const currentYear = await prisma.academicYear.findFirst({
    where: { orgId, isCurrent: true },
    select: { id: true },
  });

  if (!currentYear) {
    return {
      ...empty,
      missing: [MISSING_CURRENT_ACADEMIC_YEAR, MISSING_CLASS_SECTION_IN_CURRENT_YEAR],
    };
  }

  const [classCount, assignmentCount] = await Promise.all([
    prisma.classSection.count({ where: { yearId: currentYear.id } }),
    prisma.assignment.count({ where: { yearId: currentYear.id } }),
  ]);

  const hasClassSection = classCount > 0;
  const hasAssignment = assignmentCount > 0;

  const evidence: OrgReadinessEvidence = {
    hasCurrentYear: true,
    hasClassSectionInCurrentYear: hasClassSection,
    hasAssignmentInCurrentYear: hasAssignment,
  };

  const missing: string[] = [];
  if (!hasClassSection) missing.push(MISSING_CLASS_SECTION_IN_CURRENT_YEAR);
  if (!hasAssignment) missing.push(MISSING_ASSIGNMENT_IN_CURRENT_YEAR);

  let state: OrgReadinessState;
  if (!hasClassSection) {
    state = OrgReadinessState.R1_YEAR_READY;
  } else if (!hasAssignment) {
    state = OrgReadinessState.R2_STRUCTURE_READY;
  } else {
    state = OrgReadinessState.R3_EXECUTION_READY;
  }

  const canExecute = state === OrgReadinessState.R2_STRUCTURE_READY || state === OrgReadinessState.R3_EXECUTION_READY;

  return {
    state,
    canExecute,
    missing,
    evidence,
    currentYearId: currentYear.id,
  };
}

export const ORG_READINESS_MISSING = {
  MISSING_CURRENT_ACADEMIC_YEAR,
  MISSING_CLASS_SECTION_IN_CURRENT_YEAR,
  MISSING_ASSIGNMENT_IN_CURRENT_YEAR,
} as const;
