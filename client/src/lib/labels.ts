/**
 * Centrální prezentační mapování enumů → česká uživatelská slova.
 *
 * Interní enumy (OrganizationRole, SubmissionStatus, …) se NEMĚNÍ kvůli copy.
 * Překládají se výhradně tady, na prezentační vrstvě. Komponenty nikdy
 * nerenderují surovou enum hodnotu přímo uživateli.
 */

/** Česká jména organizačních rolí. */
export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Vlastník",
  DIRECTOR: "Ředitel",
  TEACHER: "Učitel",
  STUDENT: "Žák",
  PARENT: "Rodič",
};

/** Bezpečný překlad role. Nikdy nevrací surový uppercase enum bez pokusu o překlad. */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
}

/**
 * Česká jména stavu odevzdání (Prisma enum SubmissionStatus).
 * - PENDING  – pokus existuje, ještě není finálně vyhodnocen.
 * - APPROVED – automaticky vyhodnoceno (všechny otázky hodnotitelné).
 * - REJECTED – automatické hodnocení neproběhlo (pokus obsahuje otázky, které
 *   nelze vyhodnotit strojově); NENÍ to „propadnutí“ žáka, ale čekání na ruční
 *   opravu učitelem. Viz submissions.service.ts (unscorableQuestionIds).
 */
export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká na vyhodnocení",
  APPROVED: "Vyhodnoceno",
  REJECTED: "Čeká na ruční vyhodnocení",
};

/** Bezpečný překlad stavu odevzdání. */
export function submissionStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return SUBMISSION_STATUS_LABELS[status] ?? status;
}
