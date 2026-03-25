"use client";

/**
 * Test detail (CRUD) page — single source of truth from backend.
 *
 * State flow: mutation → await → refetch → set state from GET /tests/:id only.
 * No derived FE state for totalPoints, assignability, or question counts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/guard/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorAlert, InfoAlert, WarningAlert } from "@/components/ui/alert";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { AssignToClassModal } from "@/components/tests/AssignToClassModal";
import { EditQuestionDialog } from "@/components/tests/EditQuestionDialog";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useSubjects, subjectLabel } from "@/hooks/use-subjects";
import type { OrgSubjectOption } from "@/types";
import type { AssignabilityReport, AssignabilityIssueReason } from "@/types/assignability";
import { ALL_SCHOOL_GRADES, formatAllowedGrades, gradeLabel, type SchoolGradeValue } from "@/lib/grades";
import { Loader2, Send, Users } from "lucide-react";
import { formatDate } from "@/lib/format-date";

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

type TestTopicAssignment = {
  id: string;
  topicLevelId: string;
  isPrimary: boolean;
  topicLevel: {
    id: string;
    catalogTopic: { id: string; name: string } | null;
    subjectLevel: { grade: string | null };
  };
};

type TestEditMode = "FULL" | "LIMITED" | "NONE";

type TestDetail = {
  id: string;
  title: string;
  description?: string | null;
  subject?: { id: string; name: string; catalogSubject?: { code: string; name: string } | null } | null;
  allowedGrades: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  questions?: TestQuestion[];
  assignability?: AssignabilityReport;
  submissionCount: number;
  editMode: TestEditMode;
  /** TestAssignment rows — topic diagnostic linkage (API key: assignments) */
  assignments?: TestTopicAssignment[];
};

type FetchErrorKind = "404" | "403" | "error";

const IS_DEV =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

function devLog(...args: unknown[]) {
  if (IS_DEV) console.debug("[TestDetail]", ...args);
}

// ─── Readiness checklist ──────────────────────────────────────────────────────

const CHECKLIST: { reason: AssignabilityIssueReason; label: string }[] = [
  { reason: "NO_QUESTIONS",        label: "Otázky" },
  { reason: "NO_SCORE",            label: "Bodování" },
  { reason: "NO_CORRECT_ANSWER",   label: "Správné odpovědi" },
  { reason: "NO_ALLOWED_GRADES",   label: "Cílové ročníky" },
  { reason: "NO_TOPIC_ASSIGNMENT", label: "Téma testu" },
];

function Checklist({
  report,
  onItemClick,
}: {
  report: AssignabilityReport;
  onItemClick: (reason: AssignabilityIssueReason) => void;
}) {
  const failing = new Set(report.issues?.map((i) => i.reason) ?? []);

  if (failing.size === 0) {
    return (
      <p className="text-sm font-medium text-emerald-700">
        ✅ Test je připraven k publikaci
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CHECKLIST.map(({ reason, label }) => {
        const ok = !failing.has(reason);
        return ok ? (
          <span
            key={reason}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
          >
            ✓ {label}
          </span>
        ) : (
          <button
            key={reason}
            type="button"
            onClick={() => onItemClick(reason)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-100"
          >
            ✗ {label} →
          </button>
        );
      })}
    </div>
  );
}

// Pure helper — derives human-readable publish blockers from assignability report
function getPublishBlockingReasons(report: AssignabilityReport): string[] {
  const reasons = new Set(report.issues?.map((i) => i.reason) ?? []);
  const result: string[] = [];
  if (reasons.has("NO_QUESTIONS")) result.push("chybí otázky");
  if (reasons.has("NO_SCORE")) {
    const n = report.issues?.filter((i) => i.reason === "NO_SCORE").length ?? 0;
    result.push(`${n === 1 ? "1 otázka nemá" : `${n} otázek nemá`} bodové hodnocení`);
  }
  if (reasons.has("NO_CORRECT_ANSWER")) {
    const n = report.issues?.filter((i) => i.reason === "NO_CORRECT_ANSWER").length ?? 0;
    result.push(`${n === 1 ? "1 otázka nemá" : `${n} otázek nemá`} správnou odpověď`);
  }
  if (reasons.has("INVALID_OPTIONS")) result.push("neplatné možnosti u otázek");
  if (reasons.has("NO_ALLOWED_GRADES")) result.push("nejsou zvoleny cílové ročníky");
  return result;
}

function questionCountLabel(n: number): string {
  if (n === 1) return "1 otázka";
  if (n >= 2 && n <= 4) return `${n} otázky`;
  return `${n} otázek`;
}

// ─── Student view ─────────────────────────────────────────────────────────────

type EffectiveAssignmentStatus = "UPCOMING" | "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED" | "NO_ATTEMPTS_LEFT";

type StudentAssignment = {
  id: string;
  testId: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
  attemptsUsed: number;
  submissionId: string | null;
  submittedAt: string | null;
  submissionStatus: string | null;
  effectiveStatus: EffectiveAssignmentStatus;
};

type StudentTestDetail = {
  id: string;
  title: string;
  description: string | null;
  subject: { id: string; name: string; catalogSubject?: { code: string; name: string } | null } | null;
  allowedGrades: string[];
  academicYear?: { id: string; label: string; isCurrent: boolean } | null;
  questions: Array<{ id: string; text: string; type: string }>;
};

function assignmentTargetHref(assignment: StudentAssignment): string {
  if (assignment.submissionId || assignment.attemptsUsed > 0) {
    return `/app/results/${assignment.submissionId ?? assignment.id}`;
  }
  return `/app/assignments/${assignment.id}`;
}

function AssignmentCta({ assignment, onNavigate }: { assignment: StudentAssignment; onNavigate: () => void }): React.JSX.Element {
  switch (assignment.effectiveStatus) {
    case "SUBMITTED":
      return (
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onNavigate}>
          Zobrazit výsledek
        </Button>
      );
    case "IN_PROGRESS":
      return (
        <Button className="bg-slate-900 hover:bg-slate-800" onClick={onNavigate}>
          Pokračovat v testu
        </Button>
      );
    case "UPCOMING":
      return (
        <Button disabled className="cursor-not-allowed opacity-60">
          Dostupné od {formatDate(assignment.openAt)}
        </Button>
      );
    case "CLOSED":
      return <p className="text-sm text-slate-500">Termín pro odevzdání vypršel.</p>;
    case "NO_ATTEMPTS_LEFT":
      return <p className="text-sm text-slate-500">Vyčerpali jste všechny pokusy ({assignment.maxAttempts}/{assignment.maxAttempts}).</p>;
    case "OPEN":
    default:
      return (
        <Button className="bg-slate-900 hover:bg-slate-800" onClick={onNavigate}>
          Začít test
        </Button>
      );
  }
}

function StudentTestView({ testId }: { testId: string }): React.JSX.Element {
  const router = useRouter();
  const [test, setTest] = useState<StudentTestDetail | null>(null);
  const [assignment, setAssignment] = useState<StudentAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFetchError(null);

    const load = async () => {
      try {
        const [testData, assignments] = await Promise.all([
          fetchWithAuth<StudentTestDetail>("GET", `/tests/${testId}`),
          fetchWithAuth<StudentAssignment[]>("GET", "/assignments/my").catch(() => [] as StudentAssignment[]),
        ]);
        if (!active) return;
        setTest(testData ?? null);
        const matching = (assignments ?? []).filter((a) => a.testId === testId);
        const nowTs = Date.now();
        const open = matching.filter(
          (a) => new Date(a.openAt).getTime() <= nowTs && new Date(a.closeAt).getTime() > nowTs,
        );
        const pool = open.length > 0 ? open : matching;
        const found = pool.sort(
          (a, b) => new Date(b.closeAt).getTime() - new Date(a.closeAt).getTime(),
        )[0] ?? null;
        if (found) {
          console.log("assignment.openAt raw:", found.openAt);
        }
        setAssignment(found);
      } catch (e) {
        if (!active) return;
        setFetchError(
          e instanceof HttpError && e.status === 404 ? "404" : "error",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [testId]);

  if (loading) return <LoadingSpinner label="Načítám test" />;

  if (fetchError === "404") {
    return (
      <div className="space-y-4">
        <WarningAlert title="Test nenalezen" description="Test nenalezen nebo k němu nemáte přístup." />
        <Link href="/app/tests"><Button variant="outline">Zpět na testy</Button></Link>
      </div>
    );
  }

  if (fetchError === "error" || !test) {
    return (
      <div className="space-y-4">
        <ErrorAlert title="Chyba" description="Nepodařilo se načíst test." />
        <Link href="/app/tests"><Button variant="outline">Zpět na testy</Button></Link>
      </div>
    );
  }

  const qCount = test.questions?.length ?? 0;

  return (
    <div className="space-y-8 pb-8">
      <header className="sticky top-0 z-10 -mx-4 -mt-2 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
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
        <p className="mt-0.5 text-sm text-slate-500">
          Určeno pro: {formatAllowedGrades(test.allowedGrades)}
        </p>
        {test.academicYear && (
          <p className="mt-0.5 text-sm text-slate-500">Školní rok: {test.academicYear.label}</p>
        )}
        {qCount > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {qCount === 1 ? "1 otázka" : qCount <= 4 ? `${qCount} otázky` : `${qCount} otázek`}
          </p>
        )}
      </header>

      {!assignment && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Test ještě není přiřazen tvé třídě. Kontaktuj svého učitele.
        </div>
      )}

      {assignment && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Otevřeno od</p>
              <p className="mt-0.5 font-medium text-slate-800">
                {formatDate(assignment.openAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Uzavřeno</p>
              <p className="mt-0.5 font-medium text-slate-800">
                {formatDate(assignment.closeAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Max. pokusů</p>
              <p className="mt-0.5 font-medium text-slate-800">{assignment.maxAttempts}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <AssignmentCta assignment={assignment} onNavigate={() => router.push(assignmentTargetHref(assignment))} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function TestPageWrapper(): React.JSX.Element {
  const params = useParams<{ testId: string }>();
  const testId = params?.testId ?? null;
  const { roles } = useAuth();
  const isStudent = roles.includes("STUDENT");

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

  if (isStudent) {
    return <StudentTestView testId={testId} />;
  }

  return <TestPageInner testId={testId} />;
}

// ─── Teacher / director inner page ───────────────────────────────────────────

type AutosaveState = "idle" | "saving" | "saved" | "error";

function TestPageInner({ testId }: { testId: string }): React.JSX.Element {
  const router = useRouter();
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
  const [metadataDraft, setMetadataDraft] = useState<{ subjectId: string; allowedGrades: SchoolGradeValue[] }>({
    subjectId: "",
    allowedGrades: [],
  });
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  // flash highlight for scroll-to-error (distinct from highlightQuestionId for new questions)
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null);

  const lastQuestionRef = useRef<HTMLLIElement>(null);
  const prevQuestionCountRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the current metadataDraft is from user input (vs. initial sync from server)
  const userChangedMetadataRef = useRef(false);
  // Dynamic refs for scroll-to targeting
  const questionRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const metadataSectionRef = useRef<HTMLElement | null>(null);
  const questionsSectionRef = useRef<HTMLElement | null>(null);

  const { selectedYearId } = useAcademicYears();
  const { subjects } = useSubjects();
  const subjectOptions = useMemo<OrgSubjectOption[]>(() => {
    if (!test?.subject) return subjects;
    const exists = subjects.some((item) => item.subject.id === test.subject?.id);
    if (exists) return subjects;
    return [
      {
        id: `legacy-${test.subject.id}`,
        organizationId: "",
        isEnabled: false,
        isCustom: false,
        subject: {
          id: test.subject.id,
          name: test.subject.name,
          gradeFrom: 1,
          gradeTo: 9,
        },
      },
      ...subjects,
    ];
  }, [subjects, test?.subject]);

  // Scroll to new question
  useEffect(() => {
    if (!test) { prevQuestionCountRef.current = null; return; }
    const n = test.questions?.length ?? 0;
    if (prevQuestionCountRef.current === null) { prevQuestionCountRef.current = n; return; }
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

  // Clear success message after 4s
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // Sync test → metadataDraft on load (does NOT trigger autosave)
  useEffect(() => {
    if (!test) return;
    userChangedMetadataRef.current = false;
    setMetadataDraft({
      subjectId: test.subject?.id ?? "",
      allowedGrades: test.allowedGrades.filter((grade): grade is SchoolGradeValue =>
        ALL_SCHOOL_GRADES.includes(grade as SchoolGradeValue),
      ),
    });
  }, [test]);

  const fetchTest = useCallback(async (isRefetch = false): Promise<TestDetail | null> => {
    const currentRequestId = ++requestIdRef.current;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFetchError(null);
    if (!isRefetch) setLoading(true);
    try {
      const data = await fetchWithAuth<TestDetail>("GET", `/tests/${testId}`, { signal: controller.signal });
      if (currentRequestId !== requestIdRef.current) return null;
      setTest(data ?? null);
      return data ?? null;
    } catch (e) {
      if (typeof e === "object" && e !== null && "name" in e && e.name === "AbortError") return null;
      if (currentRequestId !== requestIdRef.current) return null;
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
      if (currentRequestId === requestIdRef.current) setLoading(false);
    }
  }, [testId]);

  useEffect(() => { fetchTest(); }, [testId, fetchTest]);
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  // Autosave metadata after 1.2s of inactivity — only fires when user changed something
  const doSaveMetadata = useCallback(async () => {
    if (!metadataDraft.subjectId && metadataDraft.allowedGrades.length === 0) return;
    setAutosaveState("saving");
    try {
      await fetchWithAuth("PATCH", `/tests/${testId}`, {
        body: {
          ...(metadataDraft.subjectId ? { subjectId: metadataDraft.subjectId } : {}),
          ...(metadataDraft.allowedGrades.length > 0 ? { allowedGrades: metadataDraft.allowedGrades } : {}),
        },
      });
      await fetchTest(true);
      setAutosaveState("saved");
      if (autosaveClearRef.current) clearTimeout(autosaveClearRef.current);
      autosaveClearRef.current = setTimeout(() => setAutosaveState("idle"), 3000);
    } catch {
      setAutosaveState("error");
    }
  }, [fetchTest, metadataDraft, testId]);

  useEffect(() => {
    if (!userChangedMetadataRef.current) return;
    if (!test || test.status !== "DRAFT") return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => void doSaveMetadata(), 1200);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [metadataDraft, test, doSaveMetadata]);

  const setSubjectId = useCallback((id: string) => {
    userChangedMetadataRef.current = true;
    setMetadataDraft((prev) => ({ ...prev, subjectId: id }));
  }, []);

  const toggleGrade = useCallback((grade: SchoolGradeValue, checked: boolean) => {
    userChangedMetadataRef.current = true;
    setMetadataDraft((prev) => ({
      ...prev,
      allowedGrades: checked
        ? [...prev.allowedGrades, grade]
        : prev.allowedGrades.filter((g) => g !== grade),
    }));
  }, []);

  const handleAddQuestion = useCallback(async () => {
    if (!test || test.status !== "DRAFT") return;
    setAddQuestionError(null);
    setAddQuestionLoading(true);
    const previousCount = test.questions?.length ?? 0;
    const nextOrder = previousCount;
    try {
      const response = await fetchWithAuth<{
        id: string; text: string; type: string; order: number | null;
        correctAnswer: string | null; correctAnswers: string[]; score: number;
      }>("POST", `/tests/${testId}/questions`, {
        body: { text: "Nová otázka", type: "TRUE_FALSE", order: nextOrder },
      });
      if (!response?.id) throw new Error("Backend nevrátil ID vytvořené otázky.");
      const refreshed = await fetchTest(true);
      const refreshedQuestions = refreshed?.questions ?? [];
      if (!refreshedQuestions.some((q) => q.id === response.id) || refreshedQuestions.length <= previousCount) {
        throw new Error("Otázka nebyla potvrzena po uložení.");
      }
      setHighlightQuestionId(response.id);
      setSuccessMessage("Otázka byla přidána.");
    } catch (e) {
      setAddQuestionError(
        e instanceof HttpError
          ? ((e.data as { message?: string })?.message ?? e.message ?? "Nepodařilo se přidat otázku.")
          : e instanceof Error ? e.message : "Nepodařilo se přidat otázku.",
      );
    } finally {
      setAddQuestionLoading(false);
    }
  }, [testId, test, fetchTest]);

  const handleDeleteQuestion = useCallback(async (questionId: string) => {
    if (!test || test.status !== "DRAFT") return;
    if (typeof window !== "undefined" && !window.confirm("Opravdu chceš smazat tuto otázku?")) return;
    setQuestionActionError(null);
    setQuestionActionLoadingId(questionId);
    try {
      await fetchWithAuth("DELETE", `/tests/${testId}/questions/${questionId}`);
      setSuccessMessage("Otázka byla smazána.");
      await fetchTest(true);
    } catch (e) {
      setQuestionActionError(
        e instanceof HttpError
          ? ((e.data as { message?: string })?.message ?? e.message ?? "Nepodařilo se smazat otázku.")
          : e instanceof Error ? e.message : "Nepodařilo se smazat otázku.",
      );
    } finally {
      setQuestionActionLoadingId(null);
    }
  }, [fetchTest, test, testId]);

  const scrollToInvalid = useCallback((reason: AssignabilityIssueReason) => {
    if (reason === "NO_ALLOWED_GRADES") {
      metadataSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (reason === "NO_QUESTIONS") {
      questionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Per-question issues: scroll to first affected question and flash it
    const issue = test?.assignability?.issues?.find((i) => i.reason === reason && i.questionId);
    if (issue?.questionId) {
      questionRefs.current[issue.questionId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusQuestionId(issue.questionId);
      setTimeout(() => setFocusQuestionId(null), 2000);
    }
  }, [test]);

  const handlePublish = useCallback(async () => {
    if (!test || test.assignability == null) return;
    if (test.status === "PUBLISHED") { setAssignOpen(true); return; }
    if (!test.assignability.isAssignable) {
      // Guide the teacher to the first blocking issue instead of silently refusing
      const firstIssue = test.assignability.issues?.[0];
      if (firstIssue) scrollToInvalid(firstIssue.reason);
      return;
    }
    setPublishError(null);
    setPublishLoading(true);
    devLog("publish start");
    try {
      await fetchWithAuth("PATCH", `/tests/${testId}`, { body: { status: "PUBLISHED" } });
      await fetchTest(true);
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
              if (i.reason === "NO_ALLOWED_GRADES") return "Test nemá nastavené cílové ročníky.";
              if (i.reason === "NO_QUESTIONS") return "Test neobsahuje otázky.";
              if (i.reason === "NO_SCORE") return "Některé otázky nemají bodové hodnocení.";
              if (i.reason === "NO_CORRECT_ANSWER") return "Některé otázky nemají správnou odpověď.";
              if (i.reason === "INVALID_OPTIONS") return "Některé otázky mají neplatné možnosti odpovědí.";
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

  // ─── Error / loading states ─────────────────────────────────────────────────

  if (loading && !test) return <LoadingSpinner label="Načítám test" />;

  if (fetchError === "404" || (!loading && !test && fetchError === null)) {
    return (
      <div className="space-y-4">
        <WarningAlert title="Test nenalezen" description="Test nenalezen." />
        <Link href="/app/tests"><Button variant="outline">Zpět na testy</Button></Link>
      </div>
    );
  }

  if (fetchError === "403") {
    return (
      <div className="space-y-4">
        <WarningAlert title="Přístup odepřen" description="Nemáte oprávnění k tomuto testu." />
        <Link href="/app/tests"><Button variant="outline">Zpět na testy</Button></Link>
      </div>
    );
  }

  if (fetchError === "error") {
    return (
      <div className="space-y-4">
        <ErrorAlert title="Chyba" description="Nepodařilo se načíst test. Zkuste to znovu." />
        <Button variant="outline" onClick={() => void fetchTest(false)}>Zkusit znovu</Button>
        <Link href="/app/tests"><Button variant="outline">Zpět na testy</Button></Link>
      </div>
    );
  }

  if (!test || test.assignability == null) {
    return (
      <div className="space-y-4">
        <ErrorAlert title="Chyba při načítání testu" description="Stav připravenosti testu nebyl načten z backendu." />
        <Link href="/app/tests"><Button variant="outline">Zpět na testy</Button></Link>
      </div>
    );
  }

  // ─── Derived state ──────────────────────────────────────────────────────────

  const isPublished = test.status === "PUBLISHED";
  const isDraft = test.status === "DRAFT";
  const canInlineEdit = false;
  const isLocked = test.editMode === "LIMITED";
  const assignability = test.assignability;
  const canPublish = assignability.isAssignable;
  const questionCount = test.questions?.length ?? 0;
  const totalPoints = assignability.totalPoints ?? 0;

  const statusLabel = isLocked
    ? "Uzamčeno"
    : test.status === "DRAFT" ? "Koncept"
    : test.status === "PUBLISHED" ? "Publikováno"
    : "Archivováno";

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-6 pb-12 transition-colors duration-200 ${isPreviewMode ? "min-h-screen bg-slate-50" : ""}`}>

      {/* Preview bar */}
      {isPreviewMode && (
        <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
          <p className="text-sm text-slate-600">Náhled — takto test uvidí žák</p>
          <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode(false)}>
            Zpět do úprav
          </Button>
        </div>
      )}

      {/* Sticky header */}
      <header className={`sticky z-10 -mx-4 -mt-2 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 ${isPreviewMode ? "top-12 bg-slate-50/95" : "top-0 bg-white/95"}`}>
        <Link href="/app/tests" className="text-xs text-slate-500 hover:text-slate-700">
          ← Zpět na testy
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          {/* Title + status */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{test.title}</h1>
              <Badge variant="neutral" className="text-xs">{statusLabel}</Badge>
            </div>
            {test.description && (
              <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{test.description}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              {questionCountLabel(questionCount)}
              {totalPoints > 0 && <span> · {totalPoints} bodů</span>}
            </p>
          </div>

          {/* Primary CTA — top right */}
          {!isPreviewMode && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/app/tests/${testId}/edit`)}
                >
                  Upravit test
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-600"
                  onClick={() => setIsPreviewMode(true)}
                >
                  Náhled
                </Button>
                {isPublished ? (
                  <Button
                    onClick={() => setAssignOpen(true)}
                    className="gap-1 bg-slate-900 hover:bg-slate-800"
                  >
                    <Users className="h-4 w-4" />
                    Přiřadit třídě
                  </Button>
                ) : (
                  // Not disabled when blocked — click scrolls to first error instead
                  <Button
                    onClick={() => void handlePublish()}
                    disabled={publishLoading}
                    className={
                      canPublish && !publishLoading
                        ? "gap-1 bg-slate-900 hover:bg-slate-800"
                        : "cursor-not-allowed gap-1 bg-slate-200 text-slate-400"
                    }
                  >
                    {publishLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Publikuji…</>
                      : <><Send className="h-4 w-4" /> Publikovat test</>
                    }
                  </Button>
                )}
              </div>

              {/* Inline blocking reasons — visible when blocked */}
              {!canPublish && isDraft && !publishLoading && (
                <div className="text-right text-xs text-slate-500">
                  {getPublishBlockingReasons(assignability).map((reason, i) => (
                    <p key={i}>· {reason}</p>
                  ))}
                </div>
              )}

              {/* Server-side publish error (e.g. 403, race condition) */}
              {publishError && (
                <p className="text-right text-xs text-red-600">{publishError}</p>
              )}
            </div>
          )}
        </div>

        {/* Readiness checklist — clickable items scroll to the problem */}
        {!isPreviewMode && isDraft && (
          <div className="mt-3">
            <Checklist report={assignability} onItemClick={scrollToInvalid} />
          </div>
        )}
      </header>

      {/* Success toast */}
      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {!isPreviewMode && isLocked && (
        <InfoAlert
          title="Tento test již obsahuje odevzdané pokusy. Úpravy otázek jsou uzamčeny."
          description="Otevřete Upravit test. Lze měnit pouze název a popis."
        />
      )}

      {/* Questions */}
      {isPreviewMode ? (
        questionCount > 0 ? (
          <section className="max-w-2xl space-y-6">
            {test.questions!.map((q, idx) => (
              <article key={q.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-base font-medium text-slate-800">
                  {idx + 1}. {q.text ?? "(bez textu)"}
                </p>
                <div className="mt-4 space-y-2">
                  {q.type === "MULTIPLE_CHOICE" && (q.options?.length ? (
                    q.options.map((opt) => (
                      <label key={opt.id} className="flex cursor-default items-center gap-2 text-slate-700">
                        <input type="radio" name={`preview-q-${q.id}`} disabled className="h-4 w-4" />
                        <span>{opt.text}</span>
                      </label>
                    ))
                  ) : (
                    (q.correctAnswers?.length ? q.correctAnswers : q.correctAnswer ? [q.correctAnswer] : ["—"]).map((a, i) => (
                      <label key={i} className="flex cursor-default items-center gap-2 text-slate-700">
                        <input type="radio" name={`preview-q-${q.id}`} disabled className="h-4 w-4" />
                        <span>{a}</span>
                      </label>
                    ))
                  ))}
                  {q.type === "TRUE_FALSE" && (
                    <div className="flex gap-6">
                      {["Ano", "Ne"].map((label) => (
                        <label key={label} className="flex cursor-default items-center gap-2 text-slate-700">
                          <input type="radio" name={`preview-q-${q.id}`} disabled className="h-4 w-4" />
                          <span>{label}</span>
                        </label>
                      ))}
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
          <section className="py-12 text-center">
            <p className="text-slate-500">Tento test neobsahuje žádné otázky.</p>
          </section>
        )
      ) : (
        <section ref={questionsSectionRef} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Otázky</h2>
            {canInlineEdit && questionCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={!isDraft || addQuestionLoading}
                onClick={() => void handleAddQuestion()}
              >
                {addQuestionLoading ? "Přidávám…" : "+ Přidat otázku"}
              </Button>
            )}
          </div>

          {addQuestionError && <ErrorAlert title="Chyba" description={addQuestionError} className="text-sm" />}
          {questionActionError && <ErrorAlert title="Chyba" description={questionActionError} className="text-sm" />}
          {!canInlineEdit && (
            <InfoAlert
              title="Detail testu je pouze pro čtení"
              description="Pro úpravy otevři režim Upravit test. Otázky se už neupravují přímo v detailu."
            />
          )}

          {questionCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-12 text-center">
              <p className="text-base text-slate-500">Žádné otázky.</p>
              <Button
                className="mt-4 bg-slate-900 hover:bg-slate-800"
                onClick={() => router.push(`/app/tests/${testId}/edit`)}
              >
                Upravit test
              </Button>
              {addQuestionError && <ErrorAlert title="Chyba" description={addQuestionError} className="mt-3 text-sm" />}
            </div>
          ) : (
            <ul className="space-y-2">
              {test.questions!.map((q, idx) => {
                const issue = assignability.issues?.find((i) => i.questionId === q.id);
                const score = q.score ?? 0;
                const correct =
                  q.correctAnswer ?? (q.correctAnswers?.length ? q.correctAnswers.join(", ") : null);
                const isLast = idx === test.questions!.length - 1;
                const isHighlight = highlightQuestionId === q.id;
                const isFocused = focusQuestionId === q.id;
                const isInvalid = !!issue;

                return (
                  <li
                    key={q.id}
                    ref={(el) => {
                      questionRefs.current[q.id] = el;
                      if (isLast) (lastQuestionRef as React.MutableRefObject<HTMLLIElement | null>).current = el;
                    }}
                    className={`rounded-lg border bg-white p-4 shadow-sm transition-colors duration-300 ${
                      isFocused
                        ? "border-amber-300 bg-amber-50 ring-1 ring-amber-200"
                        : isInvalid
                          ? "border-red-300 ring-1 ring-red-200"
                          : isHighlight
                            ? "border-emerald-200 ring-1 ring-emerald-200"
                            : "border-slate-200"
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
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>{score} bodů</span>
                          {correct
                            ? <span>Správná odpověď: {correct}</span>
                            : <span className="text-red-600 font-medium">Chybí správná odpověď</span>
                          }
                        </div>
                        {issue && issue.reason === "NO_SCORE" && (
                          <p className="text-xs font-medium text-red-600" role="alert">
                            Chybí bodové hodnocení
                          </p>
                        )}
                      </div>
                      {canInlineEdit && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-600"
                            disabled={!isDraft || questionActionLoadingId === q.id}
                            onClick={() => setEditingQuestion(q)}
                          >
                            Upravit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-600"
                            disabled={!isDraft || questionActionLoadingId === q.id}
                            onClick={() => void handleDeleteQuestion(q.id)}
                          >
                            {questionActionLoadingId === q.id ? "Mažu…" : "Smazat"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Metadata — autosave, below questions */}
      {!isPreviewMode && isDraft && canInlineEdit && (
        <section ref={metadataSectionRef} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Nastavení testu</h2>
            <span className="text-xs">
              {autosaveState === "saving" && (
                <span className="flex items-center gap-1 text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Ukládání…
                </span>
              )}
              {autosaveState === "saved" && (
                <span className="text-emerald-600">Uloženo ✓</span>
              )}
              {autosaveState === "error" && (
                <span className="flex items-center gap-1.5 text-red-600">
                  Chyba uložení –{" "}
                  <button
                    type="button"
                    className="underline hover:no-underline"
                    onClick={() => void doSaveMetadata()}
                  >
                    zkusit znovu
                  </button>
                </span>
              )}
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Předmět</span>
              <select
                value={metadataDraft.subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Vyberte předmět</option>
                {subjectOptions.map((subject) => (
                  <option key={subject.id} value={subject.subject.id}>
                    {subjectLabel(subject)}{subject.isEnabled ? "" : " (deaktivováno)"}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Cílové ročníky</span>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {ALL_SCHOOL_GRADES.map((grade) => {
                  const checked = metadataDraft.allowedGrades.includes(grade);
                  return (
                    <label
                      key={grade}
                      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                        checked ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleGrade(grade, e.target.checked)}
                      />
                      <span>{gradeLabel(grade)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {canInlineEdit && (
        <EditQuestionDialog
          open={editingQuestion !== null}
          onOpenChange={(open) => { if (!open) setEditingQuestion(null); }}
          testId={testId}
          question={editingQuestion}
          onSaved={async () => {
            await fetchTest(true);
            setSuccessMessage("Otázka byla upravena.");
          }}
        />
      )}

      <AssignToClassModal
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) setPublishError(null);
        }}
        testId={testId}
        allowedGrades={test.allowedGrades}
        yearId={selectedYearId}
        {...(test.assignments !== undefined ? { testAssignments: test.assignments } : {})}
        onSuccess={() => {
          devLog("assign success");
          setSuccessMessage("Test byl přiřazen třídě.");
          void fetchTest(true);
        }}
      />
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST, PermissionKey.EDIT_TEST, PermissionKey.VIEW_OWN_ASSIGNMENTS],
})(TestPageWrapper);
