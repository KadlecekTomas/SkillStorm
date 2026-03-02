"use client";

/**
 * Test detail (CRUD) page — single source of truth from backend.
 *
 * State flow: mutation → await → refetch → set state from GET /tests/:id only.
 * No derived FE state for totalPoints, assignability, or question counts.
 *
 * Verification checklist (manual):
 * 1) Create test
 * 2) Add question (when question CRUD is on this page)
 * 3) Refresh page manually → state consistent
 * 4) Delete question → refetch, no ghost row
 * 5) Publish (only when assignability.isAssignable)
 * 6) Assign
 * 7) Invalid test (e.g. score 0) → proper TEST_NOT_ASSIGNABLE message
 * 8) Reload → correct state
 * 9) No NaN, undefined, or duplicate rows
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorAlert, WarningAlert } from "@/components/ui/alert";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { AssignToClassModal } from "@/components/tests/AssignToClassModal";
import { EditQuestionDialog } from "@/components/tests/EditQuestionDialog";
import { useAcademicYears } from "@/hooks/use-academic-years";
import type { AssignabilityReport, AssignabilityIssueReason } from "@/types/assignability";

type QuestionOption = { id: string; text: string };

type TestQuestion = {
  id: string;
  type: string;
  text?: string;
  correctAnswer?: string | null;
  correctAnswers?: string[];
  score?: number;
  order?: number | null;
  options?: QuestionOption[];
};

type TestDetail = {
  id: string;
  title: string;
  description?: string | null;
  subject?: { id: string; name: string; catalogSubject?: { code: string; name: string } | null } | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  questions?: TestQuestion[];
  assignability?: AssignabilityReport;
};

type FetchErrorKind = "404" | "403" | "error";

const IS_DEV =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

function devLog(...args: unknown[]) {
  if (IS_DEV) {
    console.debug("[TestDetail]", ...args);
  }
}

const REASON_LABELS: Record<AssignabilityIssueReason, string> = {
  NO_QUESTIONS: "otázky",
  NO_SCORE: "bodové hodnocení",
  NO_CORRECT_ANSWER: "správná odpověď",
};

function readinessStatusLine(report: AssignabilityReport): { ready: boolean; text: string } {
  if (report.isAssignable) {
    return { ready: true, text: "Test je připraven k přiřazení." };
  }
  const reasons = new Set(report.issues?.map((i) => i.reason) ?? []);
  const parts = (["NO_QUESTIONS", "NO_SCORE", "NO_CORRECT_ANSWER"] as const)
    .filter((r) => reasons.has(r))
    .map((r) => REASON_LABELS[r]);
  const chunk = parts.length ? `chybí: ${parts.join(", ")}` : "není připraven";
  return { ready: false, text: `Test ještě není připraven (${chunk}).` };
}

function questionCountLabel(n: number): string {
  if (n === 1) return "1 otázka";
  if (n >= 2 && n <= 4) return `${n} otázky`;
  return `${n} otázek`;
}

/** Completion from assignability only: 3 conditions (questions, score, correct answer). No local recomputation. */
function completionFromAssignability(report: AssignabilityReport): { satisfied: number; total: 3; percent: number } {
  const reasons = new Set(report.issues?.map((i) => i.reason) ?? []);
  const satisfied =
    (reasons.has("NO_QUESTIONS") ? 0 : 1) +
    (reasons.has("NO_SCORE") ? 0 : 1) +
    (reasons.has("NO_CORRECT_ANSWER") ? 0 : 1);
  return { satisfied, total: 3, percent: (satisfied / 3) * 100 };
}

function progressBarFillClass(percent: number): string {
  if (percent >= 100) return "bg-emerald-500";
  if (percent >= 34) return "bg-amber-500";
  return "bg-red-500";
}

/**
 * Wrapper + Inner split for Rules of Hooks: React requires the same number and order
 * of hooks on every render. The wrapper only reads testId from the URL and guards
 * the "missing testId" case; the inner component receives testId as a required prop
 * and declares all data/effect hooks unconditionally before any conditional return.
 */
function TestPageWrapper(): React.JSX.Element {
  const params = useParams<{ testId: string }>();
  const testId = params?.testId ?? null;

  if (!testId) {
    return (
      <div className="space-y-4">
        <WarningAlert title="Chyba" description="Chybí ID testu." />
        <Link href="/app/tests">
          <Button variant="outline">Zpět na testy</Button>
        </Link>
      </div>
    );
  }

  return <TestPageInner testId={testId} />;
}

function TestPageInner({ testId }: { testId: string }): React.JSX.Element {
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<FetchErrorKind | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [highlightQuestionId, setHighlightQuestionId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [addQuestionLoading, setAddQuestionLoading] = useState(false);
  const [addQuestionError, setAddQuestionError] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<TestQuestion | null>(null);
  const [questionActionLoadingId, setQuestionActionLoadingId] = useState<string | null>(null);
  const [questionActionError, setQuestionActionError] = useState<string | null>(null);
  const lastQuestionRef = useRef<HTMLLIElement>(null);
  const prevQuestionCountRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const { selectedYearId } = useAcademicYears();

  useEffect(() => {
    const length = test?.questions?.length ?? 0;
    if (IS_DEV) {
      console.log("[TestDetail] render question length", {
        testId,
        questionLength: length,
        questionIds: (test?.questions ?? []).map((q) => q.id),
      });
    }
  }, [testId, test?.questions]);

  useEffect(() => {
    if (!test) {
      prevQuestionCountRef.current = null;
      return;
    }
    const n = test.questions?.length ?? 0;
    if (prevQuestionCountRef.current === null) {
      prevQuestionCountRef.current = n;
      return;
    }
    if (n > prevQuestionCountRef.current) {
      lastQuestionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const lastId = test?.questions?.[test.questions.length - 1]?.id;
      if (lastId) {
        setHighlightQuestionId(lastId);
        const t = setTimeout(() => setHighlightQuestionId(null), 2000);
        prevQuestionCountRef.current = n;
        return () => clearTimeout(t);
      }
    }
    prevQuestionCountRef.current = n;
  }, [test, test?.questions?.length, test?.questions]);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const fetchTest = useCallback(async (isRefetch = false): Promise<TestDetail | null> => {
    const currentRequestId = ++requestIdRef.current;

    // Abort previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setFetchError(null);
    if (!isRefetch) setLoading(true);

    try {
      const data = await fetchWithAuth<TestDetail>(
        "GET",
        `/tests/${testId}`,
        { signal: controller.signal }
      );

      // Ignore if not the latest request
      if (currentRequestId !== requestIdRef.current) {
        return null;
      }

      setTest(data ?? null);
      return data ?? null;
    } catch (e) {
      if ((e as any)?.name === "AbortError") {
        return null;
      }

      if (currentRequestId !== requestIdRef.current) {
        return null;
      }

      setTest(null);

      if (e instanceof HttpError) {
        if (e.status === 404) setFetchError("404");
        else if (e.status === 403) setFetchError("403");
        else setFetchError("error");
      } else {
        setFetchError("error");
      }

      return null;
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [testId]);

  useEffect(() => {
    fetchTest();
  }, [testId, fetchTest]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const handleAddQuestion = useCallback(async () => {
    if (!test || test.status !== "DRAFT") return;
    setAddQuestionError(null);
    setAddQuestionLoading(true);
    const previousCount = test.questions?.length ?? 0;
    const nextOrder = previousCount;
    try {
      const response = await fetchWithAuth<{
        id: string;
        text: string;
        type: string;
        order: number | null;
        correctAnswer: string | null;
        correctAnswers: string[];
        score: number;
      }>("POST", `/tests/${testId}/questions`, {
        body: {
          text: "Nová otázka",
          type: "TRUE_FALSE",
          order: nextOrder,
        },
      });
      if (IS_DEV) console.log("[TestDetail] add question response", response);
      if (!response?.id) {
        throw new Error("Backend nevrátil ID vytvořené otázky.");
      }
      const refreshed = await fetchTest(true);
      const refreshedQuestions = refreshed?.questions ?? [];
      const refreshedCount = refreshedQuestions.length;
      const containsCreated = refreshedQuestions.some((q) => q.id === response.id);
      if (IS_DEV) {
        console.log("[TestDetail] add question verification", {
          previousCount,
          refreshedCount,
          createdQuestionId: response.id,
          containsCreated,
        });
      }
      if (!containsCreated || refreshedCount <= previousCount) {
        throw new Error("Otázka nebyla potvrzena po uložení.");
      }
      setHighlightQuestionId(response.id);
      setSuccessMessage("Otázka byla přidána.");
    } catch (e) {
      const err = e as { response?: { data?: unknown }; data?: unknown };
      const errData = err?.response?.data ?? (e instanceof HttpError ? (e as HttpError).data : err?.data);
      if (IS_DEV) console.error("[TestDetail] add question error", errData ?? e);
      setAddQuestionError(
        e instanceof HttpError
          ? ((e.data as { message?: string })?.message ?? e.message ?? "Nepodařilo se přidat otázku.")
          : e instanceof Error
            ? e.message
            : "Nepodařilo se přidat otázku.",
      );
    } finally {
      setAddQuestionLoading(false);
    }
  }, [testId, test, fetchTest]);

  const handleDeleteQuestion = useCallback(
    async (questionId: string) => {
      if (!test || test.status !== "DRAFT") return;
      if (typeof window !== "undefined") {
        const confirmed = window.confirm("Opravdu chceš smazat tuto otázku?");
        if (!confirmed) return;
      }
      setQuestionActionError(null);
      setQuestionActionLoadingId(questionId);
      try {
        await fetchWithAuth("DELETE", `/tests/${testId}/questions/${questionId}`);
        setSuccessMessage("Otázka byla smazána.");
        await fetchTest(true);
      } catch (e) {
        setQuestionActionError(
          e instanceof HttpError
            ? ((e.data as { message?: string })?.message ??
                e.message ??
                "Nepodařilo se smazat otázku.")
            : e instanceof Error
              ? e.message
              : "Nepodařilo se smazat otázku.",
        );
      } finally {
        setQuestionActionLoadingId(null);
      }
    },
    [fetchTest, test, testId],
  );

  const handlePrimaryCta = useCallback(async () => {
    if (!test || test.assignability == null) return;
    const assignability = test.assignability;
    const canPublishOrAssign = assignability.isAssignable;
    const isPublished = test.status === "PUBLISHED";
    if (isPublished) {
      setAssignOpen(true);
      return;
    }
    if (!canPublishOrAssign) return;
    setPublishError(null);
    setPublishLoading(true);
    devLog("mutation start", "publish");
    try {
      await fetchWithAuth("PATCH", `/tests/${testId}`, { body: { status: "PUBLISHED" } });
      devLog("mutation success", "publish");
      await fetchTest(true);
      devLog("refetch after publish done");
      setSuccessMessage("Test byl publikován.");
      setAssignOpen(true);
    } catch (e) {
      if (e instanceof HttpError) {
        const data = e.data as { code?: string; message?: string; details?: AssignabilityReport } | undefined;
        const code = data?.code;
        const message = data?.message as string | undefined;
        if (e.status === 403) {
          setPublishError("Nemáte oprávnění publikovat tento test.");
        } else if (e.status === 409 || code === "TEST_NOT_ASSIGNABLE") {
          const details = data?.details;
          if (details?.issues?.length) {
            const reasons = details.issues.map((i) => {
              if (i.reason === "NO_QUESTIONS") return "Test neobsahuje otázky.";
              if (i.reason === "NO_SCORE") return "Některé otázky nemají bodové hodnocení.";
              if (i.reason === "NO_CORRECT_ANSWER") return "Některé otázky nemají správnou odpověď.";
              return "Test není připraven k publikaci.";
            });
            setPublishError(reasons.join(" ") || (message ?? "Test není připraven k publikaci."));
          } else {
            setPublishError(message ?? "Test není připraven k publikaci.");
          }
        } else {
          setPublishError(message ?? "Publikace se nezdařila.");
        }
      } else {
        setPublishError(e instanceof Error ? e.message : "Publikace se nezdařila.");
      }
    } finally {
      setPublishLoading(false);
    }
  }, [testId, test, fetchTest]);

  /* Conditional UI returns only after all hooks are declared. */
  if (loading && !test) {
    return <LoadingSpinner label="Načítám test" />;
  }

  if (fetchError === "404" || (!loading && !test && fetchError === null)) {
    return (
      <div className="space-y-4">
        <WarningAlert title="Test nenalezen" description="Test nenalezen." />
        <Link href="/app/tests">
          <Button variant="outline">Zpět na testy</Button>
        </Link>
      </div>
    );
  }

  if (fetchError === "403") {
    return (
      <div className="space-y-4">
        <WarningAlert
          title="Přístup odepřen"
          description="Nemáte oprávnění k tomuto testu."
        />
        <Link href="/app/tests">
          <Button variant="outline">Zpět na testy</Button>
        </Link>
      </div>
    );
  }

  if (fetchError === "error") {
    return (
      <div className="space-y-4">
        <ErrorAlert
          title="Chyba"
          description="Nepodařilo se načíst test. Zkuste to znovu."
        />
        <Button variant="outline" onClick={() => void fetchTest(false)}>
          Zkusit znovu
        </Button>
        <Link href="/app/tests">
          <Button variant="outline">Zpět na testy</Button>
        </Link>
      </div>
    );
  }

  if (!test || test.assignability == null) {
    return (
      <div className="space-y-4">
        <ErrorAlert
          title="Chyba při načítání testu"
          description="Stav připravenosti testu nebyl načten z backendu."
        />
        <Link href="/app/tests">
          <Button variant="outline">Zpět na testy</Button>
        </Link>
      </div>
    );
  }

  const isPublished = test.status === "PUBLISHED";
  const assignability = test.assignability;
  const canPublishOrAssign = assignability.isAssignable;

  const statusLabel =
    test.status === "DRAFT"
      ? "Koncept"
      : test.status === "PUBLISHED"
        ? "Publikováno"
        : "Archivováno";

  const questionCount = test.questions?.length ?? 0;
  const totalPoints = assignability.totalPoints ?? 0;
  const statusLine = readinessStatusLine(assignability);
  const primaryCtaLabel = isPublished ? "Přiřadit třídě" : "Dokončit a přiřadit";
  const primaryCtaLoadingLabel = isPublished ? "Přiřazuji…" : "Dokončuji…";
  const hasQuestions = questionCount > 0;
  const completion = completionFromAssignability(assignability);

  return (
    <div
      className={`space-y-8 pb-8 transition-colors duration-200 ${
        isPreviewMode ? "min-h-screen bg-slate-50" : ""
      }`}
    >
      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 transition-opacity">
          {successMessage}
        </div>
      )}

      {isPreviewMode && (
        <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
          <p className="text-sm text-slate-600">Režim náhledu – takto test uvidí žák</p>
          <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode(false)}>
            Zpět do úprav
          </Button>
        </div>
      )}

      <header
        className={`sticky z-10 -mx-4 -mt-2 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 ${
          isPreviewMode ? "top-12 bg-slate-50/95" : "top-0 bg-white/95"
        }`}
      >
        <Link href="/app/tests" className="text-xs text-slate-500 hover:text-slate-700">
          ← Zpět na testy
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{test.title}</h1>
        {test.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{test.description}</p>
        )}
        {test.subject && (
          <p className="mt-1 text-sm text-slate-600">
            Předmět: {test.subject.catalogSubject?.name ?? test.subject.name}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{questionCountLabel(questionCount)}</span>
            <span className="text-slate-300">|</span>
            <span>{totalPoints} bodů</span>
            {!isPreviewMode && (
              <>
                <span className="text-slate-300">|</span>
                <Badge variant="neutral" className="text-xs">{statusLabel}</Badge>
              </>
            )}
          </div>
          {!isPreviewMode && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode(true)} className="text-slate-600" aria-label="Náhled testu jako žák">
                👁 Náhled
              </Button>
              <div className="flex flex-col items-end gap-1">
                {!canPublishOrAssign ? (
                  <Button disabled className="cursor-not-allowed bg-slate-300 text-slate-500">
                    {primaryCtaLabel}
                  </Button>
                ) : (
                  <Button
                    onClick={handlePrimaryCta}
                    disabled={publishLoading}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {publishLoading ? primaryCtaLoadingLabel : primaryCtaLabel}
                  </Button>
                )}
                {!isPublished && canPublishOrAssign && (
                  <p className="text-xs text-slate-500">Po dokončení vyberete třídu.</p>
                )}
              </div>
            </div>
          )}
        </div>
        {!isPreviewMode && (
          <>
            <div className="mt-4 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full transition-all duration-300 ease-out ${progressBarFillClass(completion.percent)}`}
                  style={{ width: `${Math.min(100, completion.percent)}%` }}
                />
              </div>
              <p className="text-xs text-slate-600">
                {completion.satisfied === 3
                  ? "Test je připraven k přiřazení."
                  : `Dokončení testu: ${completion.satisfied}/3 podmínek splněno`}
              </p>
            </div>
            <p className={`mt-2 text-sm ${statusLine.ready ? "text-emerald-600" : "text-red-600"}`}>
              {statusLine.ready ? "✓ " : ""}{statusLine.text}
            </p>
          </>
        )}
      </header>

      {!isPreviewMode && publishError && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-600">Chyba</p>
          <p className="mt-0.5 text-slate-600">{publishError}</p>
        </div>
      )}

      {isPreviewMode ? (
        hasQuestions ? (
          <section className="mt-10 max-w-2xl space-y-6 transition-opacity duration-200">
            {test.questions!.map((q, idx) => (
              <article
                key={q.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-base font-medium text-slate-800">
                  {idx + 1}. {q.text ?? "(bez textu)"}
                </p>
                <div className="mt-4 space-y-2">
                  {q.type === "MULTIPLE_CHOICE" && (q.options?.length ? (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt.id}
                          className="flex cursor-default items-center gap-2 text-slate-700"
                        >
                          <input type="radio" name={`preview-q-${q.id}`} disabled className="h-4 w-4" />
                          <span>{opt.text}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(q.correctAnswers?.length ? q.correctAnswers : q.correctAnswer ? [q.correctAnswer] : ["—"]).map((a, i) => (
                        <label key={i} className="flex cursor-default items-center gap-2 text-slate-700">
                          <input type="radio" name={`preview-q-${q.id}`} disabled className="h-4 w-4" />
                          <span>{a}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                  {q.type === "TRUE_FALSE" && (
                    <div className="flex gap-6">
                      <label className="flex cursor-default items-center gap-2 text-slate-700">
                        <input type="radio" name={`preview-q-${q.id}`} disabled className="h-4 w-4" />
                        <span>Ano</span>
                      </label>
                      <label className="flex cursor-default items-center gap-2 text-slate-700">
                        <input type="radio" name={`preview-q-${q.id}`} disabled className="h-4 w-4" />
                        <span>Ne</span>
                      </label>
                    </div>
                  )}
                  {(q.type === "FILL_IN_THE_BLANK" || (q.type !== "MULTIPLE_CHOICE" && q.type !== "TRUE_FALSE")) && (
                    <textarea
                      rows={3}
                      disabled
                      placeholder="Odpověď žáka"
                      className="w-full resize-none rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                    />
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-400">({q.score ?? 0} bodů)</p>
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-10 py-12 text-center">
            <p className="text-slate-500">Tento test neobsahuje žádné otázky.</p>
          </section>
        )
      ) : hasQuestions ? (
        <section className="mt-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Otázky</h2>
            <Button
              variant="outline"
              size="sm"
              className="text-slate-600"
              disabled={test.status !== "DRAFT" || addQuestionLoading}
              onClick={() => void handleAddQuestion()}
            >
              {addQuestionLoading ? "Přidávám…" : "+ Přidat otázku"}
            </Button>
          </div>
          {addQuestionError && (
            <ErrorAlert title="Chyba" description={addQuestionError} className="text-sm" />
          )}
          {questionActionError && (
            <ErrorAlert title="Chyba" description={questionActionError} className="text-sm" />
          )}
          <ul className="grid gap-3 sm:grid-cols-1">
            {test.questions!.map((q, idx) => {
              const issue = assignability.issues?.find((i) => i.questionId === q.id);
              const score = q.score ?? 0;
              const correct =
                q.correctAnswer ??
                (q.correctAnswers?.length ? q.correctAnswers.join(", ") : "—");
              const isLast = idx === test.questions!.length - 1;
              const isHighlight = highlightQuestionId === q.id;
              return (
                <li
                  key={q.id}
                  ref={isLast ? lastQuestionRef : undefined}
                  className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-500 ${
                    isHighlight ? "bg-emerald-50/80 ring-1 ring-emerald-200" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {idx + 1} · {q.type || "otázka"}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {q.text ?? "(bez textu)"}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>({score} bodů)</span>
                        <span>Správná odpověď: {String(correct)}</span>
                      </div>
                      {issue && (
                        <p className="text-xs text-red-600" role="alert">
                          {issue.reason === "NO_SCORE" && "Chybí bodové hodnocení."}
                          {issue.reason === "NO_CORRECT_ANSWER" && "Chybí správná odpověď."}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-600"
                        disabled={test.status !== "DRAFT" || questionActionLoadingId === q.id}
                        onClick={() => setEditingQuestion(q)}
                      >
                        Upravit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-600"
                        disabled={test.status !== "DRAFT" || questionActionLoadingId === q.id}
                        onClick={() => void handleDeleteQuestion(q.id)}
                      >
                        {questionActionLoadingId === q.id ? "Mažu…" : "Smazat"}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-12 text-center">
          <p className="text-base text-slate-500">Tento test zatím neobsahuje žádné otázky.</p>
          <Button
            className="mt-4 bg-slate-900 hover:bg-slate-800"
            disabled={test.status !== "DRAFT" || addQuestionLoading}
            onClick={() => void handleAddQuestion()}
          >
            {addQuestionLoading ? "Přidávám…" : "+ Přidat první otázku"}
          </Button>
          {addQuestionError && (
            <ErrorAlert title="Chyba" description={addQuestionError} className="mt-3 text-sm" />
          )}
        </section>
      )}

      <EditQuestionDialog
        open={editingQuestion !== null}
        onOpenChange={(open) => {
          if (!open) setEditingQuestion(null);
        }}
        testId={testId}
        question={editingQuestion}
        onSaved={async () => {
          await fetchTest(true);
          setSuccessMessage("Otázka byla upravena.");
        }}
      />

      <AssignToClassModal
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) setPublishError(null);
        }}
        testId={testId}
        yearId={selectedYearId}
        onSuccess={() => {
          devLog("assign success, refetching test");
          setSuccessMessage("Test byl přiřazen třídě.");
          void fetchTest(true);
        }}
      />
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST, PermissionKey.EDIT_TEST],
})(TestPageWrapper);
