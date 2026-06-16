import { describe, expect, it } from "vitest";
import {
  answersFromResponses,
  isAnswered,
  reconcileDraft,
} from "@/lib/focus-test/draft-storage";
import type { TestDraft } from "@/lib/focus-test/types";

const baseDraft = (over: Partial<TestDraft> = {}): TestDraft => ({
  assignmentId: "a1",
  submissionId: "s1",
  answers: {},
  updatedAt: 0,
  dirtyQuestionIds: [],
  clientVersion: 0,
  ...over,
});

describe("answersFromResponses", () => {
  it("maps responses into a questionId→givenText record", () => {
    expect(
      answersFromResponses([
        { questionId: "q1", givenText: "true" },
        { questionId: "q2", givenText: "Paris" },
      ]),
    ).toEqual({ q1: "true", q2: "Paris" });
  });
});

describe("isAnswered", () => {
  it("treats non-empty trimmed strings as answered", () => {
    expect(isAnswered("x")).toBe(true);
    expect(isAnswered("")).toBe(false);
    expect(isAnswered("   ")).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
  });
});

describe("reconcileDraft", () => {
  const serverAnswers = { q1: "true", q2: "Paris" };

  it("uses the server answers when there is no draft", () => {
    const r = reconcileDraft({
      serverAnswers,
      serverUpdatedAtMs: 100,
      draft: null,
    });
    expect(r.answers).toEqual(serverAnswers);
    expect(r.dirtyQuestionIds).toEqual([]);
  });

  it("keeps a newer draft's dirty answers and marks them for re-sync", () => {
    const draft = baseDraft({
      answers: { q2: "London" },
      updatedAt: 200,
      dirtyQuestionIds: ["q2"],
      clientVersion: 5,
    });
    const r = reconcileDraft({ serverAnswers, serverUpdatedAtMs: 100, draft });
    expect(r.answers).toEqual({ q1: "true", q2: "London" });
    expect(r.dirtyQuestionIds).toEqual(["q2"]);
    expect(r.clientVersion).toBe(5);
  });

  it("prefers the server when the draft is not newer (last-write-wins)", () => {
    const draft = baseDraft({
      answers: { q2: "London" },
      updatedAt: 50,
      dirtyQuestionIds: ["q2"],
    });
    const r = reconcileDraft({ serverAnswers, serverUpdatedAtMs: 100, draft });
    expect(r.answers).toEqual(serverAnswers);
    expect(r.dirtyQuestionIds).toEqual([]);
  });
});
