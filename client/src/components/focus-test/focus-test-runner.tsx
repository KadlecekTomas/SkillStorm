"use client";

import type { JSX } from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert, InfoAlert, WarningAlert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { FocusTestSession } from "@/lib/focus-test/types";
import { isAnswered } from "@/lib/focus-test/draft-storage";
import { useFocusTest } from "@/hooks/focus-test/use-focus-test";
import { useFocusEventLogger } from "@/hooks/focus-test/use-focus-event-logger";
import { FocusTestShell } from "./focus-test-shell";
import { QuestionCard } from "./question-card";
import { QuestionNavigator } from "./question-navigator";

export interface FocusTestRunnerProps {
  session: FocusTestSession;
  /** Called after a successful submit (navigate to results) and when the student leaves. */
  onSubmitted: (submissionId: string) => void;
  onLeave: () => void;
}

export function FocusTestRunner({
  session,
  onSubmitted,
  onLeave,
}: FocusTestRunnerProps): JSX.Element {
  const [current, setCurrent] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const ctl = useFocusTest(session, { onSubmitted });
  // Audit-only telemetry (blur / visibility / connectivity). Never blocks or warns the student.
  useFocusEventLogger(session.submission.id);

  const questions = session.test.questions;
  const question = questions[current];
  const answeredFlags = questions.map((q) => isAnswered(ctl.answers[q.id]));

  const handleSubmit = useCallback(async () => {
    await ctl.submit();
    // On success the hook calls onSubmitted. Offline/error states surface inline.
  }, [ctl]);

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

  return (
    <FocusTestShell
      title={session.test.title}
      answeredCount={ctl.answeredCount}
      totalQuestions={ctl.totalQuestions}
      saveStatus={ctl.saveStatus}
      online={ctl.online}
      timer={ctl.timer}
    >
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
        {ctl.submitError && (
          <ErrorAlert title="Chyba" description={ctl.submitError} />
        )}

        <QuestionCard
          key={question.id}
          question={question}
          index={current}
          total={questions.length}
          value={ctl.answers[question.id] ?? ""}
          onChange={(value) => ctl.setAnswer(question.id, value)}
        />

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={current === 0}
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          >
            Předchozí
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={current >= questions.length - 1}
            onClick={() =>
              setCurrent((c) => Math.min(questions.length - 1, c + 1))
            }
          >
            Další
          </Button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-slate-500">
            Přehled otázek
          </p>
          <QuestionNavigator
            total={questions.length}
            current={current}
            answered={answeredFlags}
            onSelect={setCurrent}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <Button type="button" variant="ghost" onClick={attemptLeave}>
            Ukončit bez odevzdání
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={ctl.submitting}
            data-testid="submit-test"
          >
            {ctl.submitting ? "Odevzdávám…" : "Odevzdat test"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Test ještě není odevzdaný"
        description="Máš neuložené nebo neodevzdané odpovědi. Opravdu chceš odejít? Rozepsaný test zůstane uložený a můžeš se k němu vrátit."
        confirmText="Odejít"
        cancelText="Zůstat"
        onConfirm={onLeave}
      />
    </FocusTestShell>
  );
}
