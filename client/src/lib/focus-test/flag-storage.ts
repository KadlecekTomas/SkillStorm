// "Flag for review" persistence for the student answering experience.
//
// Flags are a pure client-side affordance (the student marks questions to revisit).
// They are intentionally kept in a SEPARATE localStorage key from the autosave draft so
// that this UI sugar can never interfere with the answer-sync / reconciliation logic in
// draft-storage.ts. There is no backend representation and no schema change.
const hasStorage = (): boolean =>
  typeof window !== "undefined" && !!window.localStorage;

export const flagStorageKey = (
  assignmentId: string,
  submissionId: string,
): string => `skillstorm:test-flags:${assignmentId}:${submissionId}`;

export function loadFlags(
  assignmentId: string,
  submissionId: string,
): string[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(
      flagStorageKey(assignmentId, submissionId),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    return [];
  } catch {
    return [];
  }
}

export function saveFlags(
  assignmentId: string,
  submissionId: string,
  flagged: Iterable<string>,
): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(
      flagStorageKey(assignmentId, submissionId),
      JSON.stringify([...flagged]),
    );
  } catch {
    // Quota / private-mode failures must never break the test UI.
  }
}

export function clearFlags(assignmentId: string, submissionId: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(flagStorageKey(assignmentId, submissionId));
  } catch {
    // ignore
  }
}
