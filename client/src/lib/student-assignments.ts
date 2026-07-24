/**
 * Stavově řízené CTA pro žákovské zadání.
 *
 * Jediný zdroj pravdy je backendem spočítaný `effectiveStatus`
 * (viz server my-assignments.dto.ts). Route `/app/results/[submissionId]`
 * smí dostat POUZE skutečné `submissionId` — nikdy ID zadání jako náhradu.
 */

export type EffectiveAssignmentStatus =
  | "UPCOMING"
  | "OPEN"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "CLOSED"
  | "NO_ATTEMPTS_LEFT";

export type StudentAssignmentCta =
  /** Odkaz na skutečný výsledek (submissionId je zaručeně neprázdné). */
  | { kind: "result"; label: string; href: string }
  /** Spuštění / pokračování v pokusu — míří na launcher zadání. */
  | { kind: "launch"; label: string; href: string }
  /** Žádná dostupná akce; jen informační stav (bez odkazu). */
  | { kind: "none"; label: string };

/** Kanonická cílová URL launcheru zadání (vždy s `/app` prefixem). */
export function assignmentLauncherHref(assignmentId: string): string {
  return `/app/assignments/${assignmentId}`;
}

export type AssignmentCtaInput = {
  id: string;
  submissionId: string | null;
  effectiveStatus: EffectiveAssignmentStatus;
};

/**
 * Odvodí jedinou primární akci pro řádek zadání.
 * Invariant: výsledek (`kind: "result"`) vznikne jen když `submissionId` existuje.
 */
export function resolveAssignmentCta(a: AssignmentCtaInput): StudentAssignmentCta {
  const launcherHref = assignmentLauncherHref(a.id);

  const resultOr = (fallbackLabel: string): StudentAssignmentCta =>
    a.submissionId
      ? {
          kind: "result",
          label: "Zobrazit výsledek",
          href: `/app/results/${a.submissionId}`,
        }
      : { kind: "none", label: fallbackLabel };

  switch (a.effectiveStatus) {
    case "OPEN":
      return { kind: "launch", label: "Spustit test", href: launcherHref };
    case "IN_PROGRESS":
      return { kind: "launch", label: "Pokračovat", href: launcherHref };
    case "SUBMITTED":
      return resultOr("Výsledek zatím není k dispozici");
    case "NO_ATTEMPTS_LEFT":
      return resultOr("Vyčerpané pokusy");
    case "CLOSED":
      return resultOr("Zadání je uzavřené");
    case "UPCOMING":
    default:
      return { kind: "none", label: "Zatím neotevřeno" };
  }
}
