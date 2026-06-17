"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert, InfoAlert, WarningAlert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FocusQuestion, FocusTestSession } from "@/lib/focus-test/types";
import { isAnswered } from "@/lib/focus-test/draft-storage";
import {
  clearFlags,
  loadFlags,
  saveFlags,
} from "@/lib/focus-test/flag-storage";
import { useFocusTest } from "@/hooks/focus-test/use-focus-test";
import { useFocusEventLogger } from "@/hooks/focus-test/use-focus-event-logger";
import { useAnsweringKeyboard } from "@/hooks/focus-test/use-answering-keyboard";
import { StudentAnsweringShell } from "@/components/student-answering/student-answering-shell";
import { InteractiveQuestionCard } from "@/components/student-answering/interactive-question-card";
import {
  QuestionNavigator,
  type QuestionNavItem,
} from "@/components/student-answering/question-navigator";
import { ReviewBeforeSubmitDialog } from "@/components/student-answering/review-before-submit-dialog";

export interface FocusTestRunnerProps {
  session: FocusTestSession;
  /** Called after a successful submit (navigate to results) and when the student leaves. */
  onSubmitted: (submissionId: string) => void;
  onLeave: () => void;
}

/** Resolve the ordered selectable values for a question (for digit-key selection). */
function optionValues(question: FocusQuestion): string[] {
  if (question.type === "TRUE_FALSE") return ["true", "false"];
  if (question.type === "MULTIPLE_CHOICE")
    return question.options.map((o) => o.text);
  return [];
}

export function FocusTestRunner({
  session,
  onSubmitted,
  onLeave,
}: FocusTestRunnerProps): JSX.Element {
  const assignmentId = session.assignment.id;
  const submissionId = session.submission.id;
  const questions = session.test.questions;

  const [current, setCurrent] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(
    () => new Set(loadFlags(assignmentId, submissionId)),
  );
  // Questions changed since the last fully-synced state — a display-only hint for the
  // navigator. Derived in this component so the autosave hook stays untouched.
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  const ctl = useFocusTest(session, { onSubmitted });
  // Audit-only telemetry (blur / visibility / connectivity). Never blocks or warns the student.
  useFocusEventLogger(submissionId);

  // When everything is confirmed saved, nothing is pending anymore.
  useEffect(() => {
    if (ctl.saveStatus === "saved") setPending(new Set());
  }, [ctl.saveStatus]);

  const setAnswer = useCallback(
    (questionId: string, value: string): void => {
      setPending((prev) => {
        if (prev.has(questionId)) return prev;
        const next = new Set(prev);
        next.add(questionId);
        return next;
      });
      ctl.setAnswer(questionId, value);
    },
    [ctl],
  );

  const question = questions[current];

  const persistFlags = useCallback(
    (next: Set<string>): void => {
      saveFlags(assignmentId, submissionId, next);
    },
    [assignmentId, submissionId],
  );

  const toggleFlag = useCallback(
    (questionId: string): void => {
      setFlagged((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) next.delete(questionId);
        else next.add(questionId);
        persistFlags(next);
        return next;
      });
    },
    [persistFlags],
  );

  // ── navigator state per question (answered / flagged / pending-save) ──
  const navItems: QuestionNavItem[] = useMemo(
    () =>
      questions.map((q) => ({
        answered: isAnswered(ctl.answers[q.id]),
        flagged: flagged.has(q.id),
        pending: pending.has(q.id),
      })),
    [questions, ctl.answers, pending, flagged],
  );

  const flaggedCount = navItems.filter((i) => i.flagged).length;

  const goTo = useCallback(
    (index: number): void => {
      setCurrent(Math.min(questions.length - 1, Math.max(0, index)));
    },
    [questions.length],
  );

  // ── keyboard control (disabled while any modal is open) ──
  const values = question ? optionValues(question) : [];
  useAnsweringKeyboard({
    enabled: !reviewOpen && !leaveOpen && !mapOpen,
    onPrev: () => goTo(current - 1),
    onNext: () => goTo(current + 1),
    onToggleFlag: () => question && toggleFlag(question.id),
    onOpenReview: () => setReviewOpen(true),
    onSelectOption: (index) => {
      if (question && values[index] !== undefined)
        setAnswer(question.id, values[index]);
    },
    optionCount: values.length,
  });

  const handleConfirmSubmit = useCallback(async () => {
    const result = await ctl.submit();
    if (result.ok) {
      clearFlags(assignmentId, submissionId);
      // onSubmitted (navigation) is invoked by the hook.
    }
    // Offline / sync errors stay surfaced inside the dialog via ctl state.
  }, [ctl, assignmentId, submissionId]);

  const attemptLeave = (): void => {
    if (ctl.hasUnsavedChanges) setLeaveOpen(true);
    else onLeave();
  };

  if (!question) {
    return (
      <div className="p-8">
        <WarningAlert
          title="Prázdný test"
          description="Tento test nemá žádné otázky."
        />
      </div>
    );
  }

  const navigator = (
    <QuestionNavigator items={navItems} current={current} onSelect={goTo} />
  );

  return (
    <StudentAnsweringShell
      variant="focus"
      title={session.test.title}
      progress={{
        answered: ctl.answeredCount,
        total: ctl.totalQuestions,
        flagged: flaggedCount,
      }}
      saveStatus={ctl.saveStatus}
      onlineStatus={ctl.online}
      timer={ctl.timer}
      onReview={() => setReviewOpen(true)}
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_248px] lg:gap-8">
        <div className="space-y-6">
          {ctl.autoSubmitPending && (
            <WarningAlert
              title="Čas vypršel"
              description="Odpovědi jsou uložené v zařízení. Odevzdání proběhne automaticky po obnovení připojení."
            />
          )}
          {!ctl.online && (
            <InfoAlert
              title="Offline"
              description="Offline – odpovědi jsou uložené v zařízení a odešlou se po připojení."
            />
          )}
          {ctl.submitError && !reviewOpen && (
            <ErrorAlert title="Chyba" description={ctl.submitError} />
          )}

          <InteractiveQuestionCard
            question={question}
            index={current}
            total={questions.length}
            value={ctl.answers[question.id] ?? ""}
            onChange={(value) => setAnswer(question.id, value)}
            flagged={flagged.has(question.id)}
            onToggleFlag={() => toggleFlag(question.id)}
            variant="focus"
          />

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={current === 0}
              onClick={() => goTo(current - 1)}
            >
              ← Předchozí
            </Button>
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              Mapa otázek
            </button>
            <Button
              type="button"
              variant="outline"
              disabled={current >= questions.length - 1}
              onClick={() => goTo(current + 1)}
            >
              Další →
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
            <Button type="button" variant="ghost" onClick={attemptLeave}>
              Ukončit bez odevzdání
            </Button>
            <p className="hidden text-xs text-slate-400 sm:block">
              Tip: šipkami přepínáš otázky, klávesami 1–9 vybíráš odpověď,
              F označí otázku, Ctrl/⌘+Enter otevře kontrolu.
            </p>
          </div>
        </div>

        {/* Desktop rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">
              Přehled otázek
            </p>
            {navigator}
          </div>
        </aside>
      </div>

      {/* Mobile question map (bottom sheet) */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Přehled otázek</DialogTitle>
            <DialogDescription>
              Klepnutím přejdeš na vybranou otázku.
            </DialogDescription>
          </DialogHeader>
          <QuestionNavigator
            items={navItems}
            current={current}
            onSelect={(i) => {
              goTo(i);
              setMapOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <ReviewBeforeSubmitDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        answered={ctl.answeredCount}
        total={ctl.totalQuestions}
        flagged={flaggedCount}
        online={ctl.online}
        hasUnsaved={ctl.hasUnsavedChanges}
        saveStatus={ctl.saveStatus}
        submitting={ctl.submitting}
        submitError={ctl.submitError}
        onConfirm={handleConfirmSubmit}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Test ještě není odevzdaný"
        description="Máš neuložené nebo neodevzdané odpovědi. Opravdu chceš odejít? Rozepsaný test zůstane uložený a můžeš se k němu vrátit."
        confirmText="Odejít"
        cancelText="Zůstat"
        onConfirm={onLeave}
      />
    </StudentAnsweringShell>
  );
}
