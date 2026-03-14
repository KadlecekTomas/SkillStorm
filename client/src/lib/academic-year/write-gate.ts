/**
 * Centralised academic-year write-gate.
 *
 * Use this instead of duplicating (isAcademicYearExpired && !canManage)
 * conditionals across every UI component.
 *
 * Rule: when the active year has expired, only users with management
 * permissions (MANAGE_TEACHERS → DIRECTOR / OWNER) may still perform
 * write operations.  Teachers and students are blocked until the
 * director creates the next academic year.
 *
 * Usage:
 *   const { isAcademicYearExpired } = useAcademicYears();
 *   const { can } = usePermissions();
 *   const blocked = isYearWriteBlocked(isAcademicYearExpired, can(PermissionKey.MANAGE_TEACHERS));
 *
 *   <Button disabled={blocked}>…</Button>
 */
export function isYearWriteBlocked(
  isAcademicYearExpired: boolean,
  canManage: boolean,
): boolean {
  return isAcademicYearExpired && !canManage;
}
