/**
 * App state model. organization.status is the SINGLE source of truth for OWNER accessibility.
 * Readiness is DERIVED (from backend), evaluated ONLY when status === ACTIVE. SUSPENDED ≠ PENDING.
 *
 * - ORG_PENDING: approval waiting; /onboarding/pending. Never treat as SUSPENDED.
 * - ORG_SUSPENDED: hard block; /organization-suspended. No retry, no onboarding/repair.
 * - ORG_NOT_READY: ACTIVE only; /app/classrooms is the ONLY repair/init surface.
 * - READY: render domain modules.
 *
 * Any change that violates status-driven semantics is a SEVERE DOMAIN BUG.
 */

export type AppStateCode =
  | "BOOTSTRAPPING"
  | "UNAUTHENTICATED"
  | "ORG_PENDING"
  | "ORG_SUSPENDED"
  | "ORG_NOT_READY"
  | "READY"
  | "ERROR";

/** Backend error codes we map to explicit state screens; never show as generic "permissions". */
export const BACKEND_STATE_CODES = {
  ORG_PENDING: "ORG_PENDING",
  ORG_NOT_READY: "ORG_NOT_READY",
  /** Canonical: no current academic year. */
  NO_CURRENT_ACADEMIC_YEAR: "NO_CURRENT_ACADEMIC_YEAR",
  /** @deprecated Use NO_CURRENT_ACADEMIC_YEAR. Accepted for backward compatibility. */
  NO_ACTIVE_ACADEMIC_YEAR: "NO_ACTIVE_ACADEMIC_YEAR",
  /** Init/repair state: no class in current year yet. Must NOT block POST /classrooms (backend allows first class). */
  NO_CLASS_SECTION: "NO_CLASS_SECTION",
  CLASS_NOT_IN_CURRENT_YEAR: "CLASS_NOT_IN_CURRENT_YEAR",
  /** @deprecated Use CLASS_NOT_IN_CURRENT_YEAR. Accepted for backward compatibility. */
  CLASS_NOT_IN_ACTIVE_YEAR: "CLASS_NOT_IN_ACTIVE_YEAR",
  /** Canonical: more than one current year. */
  MULTIPLE_CURRENT_ACADEMIC_YEARS: "MULTIPLE_CURRENT_ACADEMIC_YEARS",
  /** @deprecated Use MULTIPLE_CURRENT_ACADEMIC_YEARS. Accepted for backward compatibility. */
  MULTIPLE_ACTIVE_ACADEMIC_YEARS: "MULTIPLE_ACTIVE_ACADEMIC_YEARS",
  ACADEMIC_YEAR_INVARIANT_BROKEN: "ACADEMIC_YEAR_INVARIANT_BROKEN",
} as const;

export type AppState = {
  code: AppStateCode;
  /** When code === ORG_NOT_READY or ERROR, the backend error code for mapping to the right screen. */
  errorCode?: string | null;
  /** When code === READY, the current academic year label for display. */
  currentYearName?: string | null;
};

/** Bootstrap shape used for repair-state detection (avoids coupling to full org type). */
export type OrgBootstrapForReadiness = {
  hasClassrooms?: boolean;
  /** Prefer current; accept deprecated alias for one release. */
  hasClassroomsInCurrentYear?: boolean;
  hasClassroomsInActiveYear?: boolean;
} | null | undefined;

/**
 * Repair state: org has classrooms and academic year, but no classroom in the current year.
 * Allowed on both /onboarding/setup and /app/classrooms. Never redirect away from these routes in this state.
 */
export function isRepairStateClassrooms(bootstrap: OrgBootstrapForReadiness): boolean {
  const inCurrentYear =
    bootstrap?.hasClassroomsInCurrentYear === true || bootstrap?.hasClassroomsInActiveYear === true;
  return bootstrap?.hasClassrooms === true && !inCurrentYear;
}

/**
 * True when app state is ORG_NOT_READY with errorCode CLASS_NOT_IN_CURRENT_YEAR (or deprecated) and bootstrap matches repair state.
 * Used by AppReadinessGate to allow /app/classrooms to render (repair screen).
 */
export function isRepairStateFromAppState(
  code: AppStateCode,
  errorCode: string | null | undefined,
  bootstrap: OrgBootstrapForReadiness,
): boolean {
  const isClassNotInCurrentYear =
    errorCode === BACKEND_STATE_CODES.CLASS_NOT_IN_CURRENT_YEAR ||
    errorCode === BACKEND_STATE_CODES.CLASS_NOT_IN_ACTIVE_YEAR;
  return (
    code === "ORG_NOT_READY" && isClassNotInCurrentYear && isRepairStateClassrooms(bootstrap)
  );
}
