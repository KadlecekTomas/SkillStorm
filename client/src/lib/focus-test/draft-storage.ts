// Pure localStorage access + draft reconciliation for Focus Test Mode.
// No React here so the conflict logic stays unit-testable.
import type { AnswerMap, TestDraft } from "./types";

export const draftStorageKey = (
  assignmentId: string,
  submissionId: string,
): string => `skillstorm:test-draft:${assignmentId}:${submissionId}`;

const hasStorage = (): boolean =>
  typeof window !== "undefined" && !!window.localStorage;

export function loadDraft(
  assignmentId: string,
  submissionId: string,
): TestDraft | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(
      draftStorageKey(assignmentId, submissionId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TestDraft;
    if (
      parsed &&
      parsed.submissionId === submissionId &&
      parsed.assignmentId === assignmentId &&
      typeof parsed.answers === "object"
    ) {
      return {
        ...parsed,
        answers: parsed.answers ?? {},
        dirtyQuestionIds: parsed.dirtyQuestionIds ?? [],
        clientVersion: parsed.clientVersion ?? 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: TestDraft): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(
      draftStorageKey(draft.assignmentId, draft.submissionId),
      JSON.stringify(draft),
    );
  } catch {
    // Quota / private-mode failures must never break the test UI.
  }
}

export function clearDraft(assignmentId: string, submissionId: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(draftStorageKey(assignmentId, submissionId));
  } catch {
    // ignore
  }
}

/**
 * Last-write-wins reconciliation between the server's persisted responses and a
 * local draft. The server is the baseline; only locally-dirty answers from a draft
 * that is newer than the server submission survive (and stay dirty so they re-sync).
 */
export function reconcileDraft(params: {
  serverAnswers: AnswerMap;
  serverUpdatedAtMs: number;
  draft: TestDraft | null;
}): { answers: AnswerMap; dirtyQuestionIds: string[]; clientVersion: number } {
  const { serverAnswers, serverUpdatedAtMs, draft } = params;
  if (!draft || draft.dirtyQuestionIds.length === 0) {
    return { answers: { ...serverAnswers }, dirtyQuestionIds: [], clientVersion: draft?.clientVersion ?? 0 };
  }
  // Only trust local edits if the draft is strictly newer than the server state.
  if (draft.updatedAt <= serverUpdatedAtMs) {
    return { answers: { ...serverAnswers }, dirtyQuestionIds: [], clientVersion: draft.clientVersion };
  }
  const answers: AnswerMap = { ...serverAnswers };
  const dirty: string[] = [];
  for (const qid of draft.dirtyQuestionIds) {
    const value = draft.answers[qid];
    if (value !== undefined) {
      answers[qid] = value;
      dirty.push(qid);
    }
  }
  return { answers, dirtyQuestionIds: dirty, clientVersion: draft.clientVersion };
}

export function answersFromResponses(
  responses: Array<{ questionId: string; givenText: string }>,
): AnswerMap {
  const map: AnswerMap = {};
  for (const r of responses) {
    map[r.questionId] = r.givenText;
  }
  return map;
}

export function isAnswered(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
