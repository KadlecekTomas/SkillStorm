"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import {
  answersFromResponses,
  clearDraft as clearDraftStorage,
  isAnswered,
  loadDraft,
  reconcileDraft,
  saveDraft,
} from "@/lib/focus-test/draft-storage";
import type {
  AnswerMap,
  FocusTestSession,
  SaveStatus,
  TestDraft,
} from "@/lib/focus-test/types";
import { useOnlineStatus } from "./use-online-status";
import { useTestTimer, type TestTimerState } from "./use-test-timer";

const DEBOUNCE_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export interface SubmitResult {
  ok: boolean;
  submissionId?: string;
  /** Submit was refused because the device is offline; the draft stays saved locally. */
  blockedOffline?: boolean;
}

export interface FocusTestController {
  answers: AnswerMap;
  setAnswer: (questionId: string, value: string) => void;
  saveStatus: SaveStatus;
  online: boolean;
  timer: TestTimerState | null;
  answeredCount: number;
  totalQuestions: number;
  hasUnsavedChanges: boolean;
  submitting: boolean;
  submitError: string | null;
  /** Set once the timer expired but submit is blocked offline. */
  autoSubmitPending: boolean;
  submit: () => Promise<SubmitResult>;
}

export function useFocusTest(
  session: FocusTestSession,
  options: { onSubmitted: (submissionId: string) => void },
): FocusTestController {
  const { onSubmitted } = options;
  const assignmentId = session.assignment.id;
  const submissionId = session.submission.id;

  const online = useOnlineStatus();

  // ── initial state: server responses reconciled with any newer local draft ──
  const initial = useMemo(() => {
    const serverAnswers = answersFromResponses(session.responses);
    const draft: TestDraft | null = loadDraft(assignmentId, submissionId);
    return reconcileDraft({
      serverAnswers,
      serverUpdatedAtMs: new Date(session.submission.updatedAt).getTime(),
      draft,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, submissionId]);

  const [answers, setAnswers] = useState<AnswerMap>(initial.answers);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initial.dirtyQuestionIds.length > 0 ? "saving" : "saved",
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autoSubmitPending, setAutoSubmitPending] = useState(false);

  // ── refs that always hold the latest values for async flushers ──
  const answersRef = useRef<AnswerMap>(initial.answers);
  const dirtyRef = useRef<Set<string>>(new Set(initial.dirtyQuestionIds));
  const clientVersionRef = useRef<number>(initial.clientVersion);
  const onlineRef = useRef(online);
  const flushingRef = useRef<Promise<void> | null>(null);
  const flushRef = useRef<(() => Promise<boolean>) | null>(null);
  const debounceRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  const persistDraft = useCallback((): void => {
    const draft: TestDraft = {
      assignmentId,
      submissionId,
      answers: answersRef.current,
      updatedAt: Date.now(),
      dirtyQuestionIds: [...dirtyRef.current],
      clientVersion: clientVersionRef.current,
    };
    saveDraft(draft);
  }, [assignmentId, submissionId]);

  // Schedulers reference the latest flush via flushRef → no declaration cycle.
  const scheduleFlush = useCallback((delay: number): void => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void flushRef.current?.();
    }, delay);
  }, []);

  const scheduleRetry = useCallback((): void => {
    if (retryRef.current) window.clearTimeout(retryRef.current);
    const attempt = retryAttemptRef.current + 1;
    retryAttemptRef.current = attempt;
    const backoff = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    retryRef.current = window.setTimeout(() => {
      if (onlineRef.current && dirtyRef.current.size > 0) {
        void flushRef.current?.();
      }
    }, backoff);
  }, []);

  // ── core server flush of dirty answers (idempotent on the backend) ──
  const flush = useCallback(async (): Promise<boolean> => {
    if (flushingRef.current) {
      try {
        await flushingRef.current;
      } catch {
        /* surfaced below */
      }
    }
    const dirtyIds = [...dirtyRef.current];
    if (dirtyIds.length === 0) {
      if (!submittedRef.current) setSaveStatus("saved");
      return true;
    }
    if (!onlineRef.current) {
      setSaveStatus("offline");
      return false;
    }

    setSaveStatus("saving");
    const sentValues = new Map(
      dirtyIds.map((qid) => [qid, answersRef.current[qid] ?? ""]),
    );
    const responses = dirtyIds.map((qid) => ({
      questionId: qid,
      givenText: sentValues.get(qid) ?? "",
    }));

    const run = (async (): Promise<void> => {
      await fetchWithAuth<{ success: boolean }>(
        "PATCH",
        `/submissions/${submissionId}/responses`,
        { body: { responses, clientVersion: clientVersionRef.current } },
      );
    })();
    flushingRef.current = run;

    try {
      await run;
      // Clear only questions whose value the server now holds (a newer edit stays dirty).
      for (const qid of dirtyIds) {
        if (answersRef.current[qid] === sentValues.get(qid)) {
          dirtyRef.current.delete(qid);
        }
      }
      persistDraft();
      retryAttemptRef.current = 0;
      if (dirtyRef.current.size === 0) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("saving");
        scheduleFlush(0);
      }
      return true;
    } catch {
      setSaveStatus("error");
      scheduleRetry();
      return false;
    } finally {
      flushingRef.current = null;
    }
  }, [submissionId, persistDraft, scheduleFlush, scheduleRetry]);

  flushRef.current = flush;

  const setAnswer = useCallback(
    (questionId: string, value: string): void => {
      setAnswers((prev) => {
        const next = { ...prev, [questionId]: value };
        answersRef.current = next;
        return next;
      });
      dirtyRef.current.add(questionId);
      clientVersionRef.current += 1;
      persistDraft();
      setSaveStatus(onlineRef.current ? "saving" : "offline");
      scheduleFlush(DEBOUNCE_MS);
    },
    [persistDraft, scheduleFlush],
  );

  // ── submit: force-sync, then finish; never submit while offline ──
  const runSubmit = useCallback(async (): Promise<SubmitResult> => {
    if (submittedRef.current) return { ok: true, submissionId };
    setSubmitError(null);
    if (!onlineRef.current) {
      setAutoSubmitPending(true);
      setSubmitError(
        "Test je uložený v zařízení, ale nelze ho odevzdat bez připojení k internetu.",
      );
      return { ok: false, blockedOffline: true };
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const synced = await flush();
    if (!synced) {
      const offline = !onlineRef.current;
      if (offline) setAutoSubmitPending(true);
      setSubmitError(
        offline
          ? "Test je uložený v zařízení, ale nelze ho odevzdat bez připojení k internetu."
          : "Odpovědi se nepodařilo uložit. Zkus to prosím znovu.",
      );
      return { ok: false, blockedOffline: offline };
    }

    setSubmitting(true);
    try {
      const responses = session.test.questions
        .filter((q) => isAnswered(answersRef.current[q.id]))
        .map((q) => ({
          questionId: q.id,
          givenText: answersRef.current[q.id] ?? "",
        }));
      await fetchWithAuth("POST", `/submissions/${submissionId}/finish`, {
        body: { responses },
      });
      submittedRef.current = true;
      setAutoSubmitPending(false);
      clearDraftStorage(assignmentId, submissionId);
      onSubmitted(submissionId);
      return { ok: true, submissionId };
    } catch (err) {
      const message =
        err instanceof HttpError && err.status === 403
          ? "Nemáš oprávnění odevzdat tento test."
          : err instanceof HttpError && err.status === 409
            ? "Test už byl odevzdán."
            : "Odevzdání selhalo. Zkus to prosím znovu.";
      setSubmitError(message);
      return { ok: false };
    } finally {
      setSubmitting(false);
    }
  }, [assignmentId, submissionId, flush, onSubmitted, session.test.questions]);

  // ── on reconnect, push anything still dirty + retry a pending auto-submit ──
  useEffect(() => {
    if (online) {
      if (dirtyRef.current.size > 0 && !submittedRef.current) void flush();
      if (autoSubmitPending && !submittedRef.current) void runSubmit();
    } else if (dirtyRef.current.size > 0) {
      setSaveStatus("offline");
    }
  }, [online, autoSubmitPending, flush, runSubmit]);

  // ── guard accidental tab close while unsaved ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent): void => {
      if (dirtyRef.current.size > 0 && !submittedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (retryRef.current) window.clearTimeout(retryRef.current);
    };
  }, []);

  // ── timer (informational) — on expiry, force-save and attempt auto-submit ──
  const timer = useTestTimer(
    {
      startedAt: session.submission.startedAt,
      timeLimitSec: session.assignment.timeLimitSec,
      closeAt: session.assignment.closeAt,
    },
    useCallback(() => {
      void runSubmit();
    }, [runSubmit]),
  );

  const totalQuestions = session.test.questions.length;
  const answeredCount = session.test.questions.reduce(
    (acc, q) => (isAnswered(answers[q.id]) ? acc + 1 : acc),
    0,
  );

  return {
    answers,
    setAnswer,
    saveStatus,
    online,
    timer,
    answeredCount,
    totalQuestions,
    hasUnsavedChanges: dirtyRef.current.size > 0,
    submitting,
    submitError,
    autoSubmitPending,
    submit: runSubmit,
  };
}
