/**
 * Global application readiness model – deliberate state machine.
 *
 * This is system-level consistency enforcement, not a UI workaround. The frontend
 * is NOT responsible for domain validity; it only reflects backend state. Backend
 * (ApplicationReadinessGuard) and frontend (AppReadinessGate) together enforce the
 * invariant: invalid application state MUST NOT be shown to the user.
 *
 * Single source of truth: derived ONLY from backend responses (/auth/me + GET /academic-years/current).
 * Domain modules MUST NOT render unless AppState === READY.
 *
 * State machine (thesis-defensible):
 * - BOOTSTRAPPING: transient only; resolves to READY, ORG_*, or ERROR (with timeout).
 * - ORG_PENDING / ORG_SUSPENDED / ORG_NOT_READY: structured 409 from backend → dedicated state screen.
 * - READY: org ACTIVE + exactly one current academic year.
 * - ERROR: failure or timeout → user can Retry; no silent fallback to READY.
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
  NO_ACTIVE_ACADEMIC_YEAR: "NO_ACTIVE_ACADEMIC_YEAR",
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
