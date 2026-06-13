"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/table";
import type { TestSummary } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { InfoAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { withGuard } from "@/lib/guard/withGuard";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import Link from "next/link";
import { PermissionKey } from "@/types";
import { AssignToClassModal } from "@/components/tests/AssignToClassModal";
import { useSubjects, subjectLabel } from "@/hooks/use-subjects";
import type { Subject } from "@/types";
import { formatPercent, formatInt } from "@/utils/format";
import { ALL_SCHOOL_GRADES, gradeLabel, normalizeAllowedGrades } from "@/lib/grades";
import { Loader2, Pencil, Send, Users, Archive, Eye } from "lucide-react";
import { useTestsList, type TestListItem } from "@/hooks/use-tests-list";
import { refreshListAfterMutation } from "@/lib/list-query";

type EffectiveAssignmentStatus = "UPCOMING" | "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED" | "NO_ATTEMPTS_LEFT";

type MyAssignment = {
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

const STATUS_CONFIG: Record<EffectiveAssignmentStatus, { label: string; className: string }> = {
  SUBMITTED:        { label: "Odevzdáno",       className: "bg-emerald-100 text-emerald-800" },
  IN_PROGRESS:      { label: "Probíhá",          className: "bg-blue-100 text-blue-800" },
  OPEN:             { label: "Otevřeno",          className: "bg-amber-100 text-amber-800" },
  CLOSED:           { label: "Uzavřeno",          className: "bg-slate-100 text-slate-600" },
  UPCOMING:         { label: "Připravuje se",     className: "bg-slate-100 text-slate-400" },
  NO_ATTEMPTS_LEFT: { label: "Pokusy vyčerpány", className: "bg-red-100 text-red-700" },
};

function subjectName(test: TestSummary): string {
  const s = test.subject;
  if (!s || typeof s !== "object") return "—";
  return s.name;
}

function gradesText(test: TestSummary): string {
  return normalizeAllowedGrades(test.allowedGrades).map(gradeLabel).join(", ") || "—";
}

function studentAssignmentTargetHref(testId: string, assignment?: MyAssignment): string {
  if (assignment?.submissionId) {
    return `/app/results/${assignment.submissionId}`;
  }
  return `/app/tests/${testId}`;
}

// ─── Test Row (teacher / director) ───────────────────────────────────────────

type TestRowProps = {
  test: TestListItem;
  onPublish: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onAssign: (id: string) => void;
  loadingId: string | null;
  showCreator?: true;
};

function TestRow({ test, onPublish, onArchive, onAssign, loadingId, showCreator }: TestRowProps) {
  const router = useRouter();
  const busy = loadingId === test.id;
  const creatorName = showCreator ? (test.creator?.user?.name ?? "Neznámý autor") : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{test.title}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {subjectName(test)}
          {gradesText(test) !== "—" && <span className="ml-2 text-slate-400">· {gradesText(test)}</span>}
          {creatorName && <span className="ml-2 text-slate-400">· {creatorName}</span>}
        </p>
      </div>

      {test.status === "PUBLISHED" && (
        <div className="hidden sm:flex items-center gap-4 text-sm text-slate-500">
          <span>Odevzdání: <strong className="text-slate-700">{formatInt(test.submissions)}</strong></span>
          <span>Průměr: <strong className="text-slate-700">{formatPercent(test.avgScore)}</strong></span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {test.status === "DRAFT" && (
          <>
            <Button variant="outline" size="sm" onClick={() => router.push(`/app/tests/${test.id}/edit`)} className="gap-1">
              <Pencil className="h-3.5 w-3.5" />
              Upravit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onPublish(test.id)}
              disabled={busy}
              className="gap-1"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Publikovat
            </Button>
          </>
        )}

        {test.status === "PUBLISHED" && (
          <>
            <Button variant="outline" size="sm" onClick={() => router.push(`/app/tests/${test.id}`)} className="gap-1">
              <Eye className="h-3.5 w-3.5" />
              Zobrazit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAssign(test.id)} className="gap-1">
              <Users className="h-3.5 w-3.5" />
              Přiřadit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onArchive(test.id)}
              disabled={busy}
              className="gap-1"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
              Archivovat
            </Button>
          </>
        )}

        {test.status === "ARCHIVED" && (
          <Button variant="outline" size="sm" onClick={() => router.push(`/app/tests/${test.id}`)} className="gap-1">
            <Eye className="h-3.5 w-3.5" />
            Zobrazit
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
  emptyMessage,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{count}</span>
      </h3>
      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

// ─── Student DataTable columns ────────────────────────────────────────────────

const studentColumns: Column<TestSummary>[] = [
  { key: "title", label: "Test" },
  {
    key: "subject",
    label: "Předmět",
    render: (row) => subjectName(row),
  },
  {
    key: "allowedGrades",
    label: "Ročníky",
    render: (row) => gradesText(row),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function TestsPage(): React.JSX.Element {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTestId, setAssignTestId] = useState<string | null>(null);
  const [subjectFilterId, setSubjectFilterId] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [studentAssignments, setStudentAssignments] = useState<MyAssignment[]>([]);
  const router = useRouter();
  const { org, context, user } = useAuth();
  const { selectedYearId } = useAcademicYears();
  const { subjects: orgSubjects } = useSubjects();

  const isDirector = user?.organizationRole === "DIRECTOR" || user?.organizationRole === "OWNER";
  const isStudent = user?.organizationRole === "STUDENT";

  const {
    tests,
    loading,
    error: testsError,
    refetch: refetchTests,
  } = useTestsList({
    enabled: !!org?.id,
    organizationId: org?.id ?? null,
    academicYearId: selectedYearId,
    subjectId: subjectFilterId,
    grade: gradeFilter,
  });

  const fetchError = !!testsError;

  useEffect(() => {
    if (!isStudent || !org?.id) return;
    let cancelled = false;
    fetchWithAuth<{ data?: MyAssignment[] } | MyAssignment[]>("GET", "/assignments/my")
      .then((res) => {
        if (cancelled) return;
        const list = res && typeof res === "object" && "data" in res
          ? (res as { data?: MyAssignment[] }).data ?? []
          : Array.isArray(res) ? res : [];
        setStudentAssignments(list);
      })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [isStudent, org?.id]);

  const teachers = useMemo(() => {
    const names = new Set<string>();
    tests.forEach((t) => {
      const name = t.creator?.user?.name?.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [tests]);

  const filteredTests = useMemo(() => {
    let list = tests;
    if (teacherFilter) {
      list = list.filter((t) => t.creator?.user?.name?.trim() === teacherFilter);
    }
    if (subjectFilterId) {
      list = list.filter((t) => t.subject && typeof t.subject === "object" && (t.subject as Subject).id === subjectFilterId);
    }
    if (gradeFilter) {
      list = list.filter((t) => normalizeAllowedGrades(t.allowedGrades).includes(gradeFilter));
    }
    return list;
  }, [gradeFilter, subjectFilterId, teacherFilter, tests]);

  const studentAssignmentsByTestId = useMemo(() => {
    const map: Record<string, MyAssignment> = {};
    for (const a of studentAssignments) {
      const existing = map[a.testId];
      if (!existing) { map[a.testId] = a; continue; }
      const now = Date.now();
      const aIsOpen = new Date(a.openAt).getTime() <= now && new Date(a.closeAt).getTime() > now;
      const exIsOpen = new Date(existing.openAt).getTime() <= now && new Date(existing.closeAt).getTime() > now;
      if (aIsOpen && !exIsOpen) { map[a.testId] = a; continue; }
      if (!aIsOpen && exIsOpen) continue;
      if (new Date(a.closeAt).getTime() > new Date(existing.closeAt).getTime()) map[a.testId] = a;
    }
    return map;
  }, [studentAssignments]);

  const draftTests = useMemo(() => filteredTests.filter((t) => t.status === "DRAFT"), [filteredTests]);
  const publishedTests = useMemo(() => filteredTests.filter((t) => t.status === "PUBLISHED"), [filteredTests]);
  const archivedTests = useMemo(() => filteredTests.filter((t) => t.status === "ARCHIVED"), [filteredTests]);

  const handlePublish = async (id: string) => {
    setLoadingId(id);
    try {
      await fetchWithAuth("PATCH", `/tests/${id}`, { body: { status: "PUBLISHED" } });
      await refreshListAfterMutation({
        resource: "tests",
        refetch: refetchTests,
        invalidatePrefixes: [["dashboard"]],
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleArchive = async (id: string) => {
    setLoadingId(id);
    try {
      await fetchWithAuth("PATCH", `/tests/${id}`, { body: { status: "ARCHIVED" } });
      await refreshListAfterMutation({
        resource: "tests",
        refetch: refetchTests,
        invalidatePrefixes: [["dashboard"]],
      });
    } finally {
      setLoadingId(null);
    }
  };

  const studentColumnsWithStatus: Column<TestSummary>[] = useMemo(() => [
    ...studentColumns,
    {
      key: "studentStatus",
      label: "Stav",
      render: (row) => {
        const assignment = studentAssignmentsByTestId[row.id];
        const status: EffectiveAssignmentStatus = assignment?.effectiveStatus ?? "UPCOMING";
        const cfg = STATUS_CONFIG[status];
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
            {cfg.label}
          </span>
        );
      },
    },
  ], [studentAssignmentsByTestId]);

  return (
    <div className="space-y-8">
      {fetchError && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-600">Chyba načítání</p>
          <p className="mt-0.5 text-slate-600">Seznam testů se nepovedlo načíst.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetchTests()}>
            Zkusit znovu
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {isDirector ? "Testy v organizaci" : isStudent ? "Přiřazené testy" : "Moje testy"}
          </h2>
          <p className="text-sm text-slate-500">
            {isDirector
              ? "Všechny testy a přiřazení. Filtruj podle učitele."
              : isStudent
              ? "Testy přiřazené tobě nebo tvé třídě."
              : "Přehled testů, odevzdání a průměry."}
          </p>
        </div>
        {!isStudent && (
          <Link
            href="/app/tests/create"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            + Vytvořit test
          </Link>
        )}
      </div>

      {/* Filters */}
      {!isStudent && (
        <div className="flex flex-wrap items-center gap-4">
          {isDirector && teachers.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="teacher-filter" className="text-sm font-medium text-slate-700">Učitel:</label>
              <select
                id="teacher-filter"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
              >
                <option value="">Všichni</option>
                {teachers.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          {orgSubjects.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="subject-filter" className="text-sm font-medium text-slate-700">Předmět:</label>
              <select
                id="subject-filter"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={subjectFilterId}
                onChange={(e) => setSubjectFilterId(e.target.value)}
              >
                <option value="">Všechny</option>
                {orgSubjects.map((s) => (
                  <option key={s.id} value={s.subject.id}>{subjectLabel(s)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="grade-filter" className="text-sm font-medium text-slate-700">Ročník:</label>
            <select
              id="grade-filter"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
            >
              <option value="">Všechny</option>
              {ALL_SCHOOL_GRADES.map((grade) => (
                <option key={grade} value={grade}>{gradeLabel(grade)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {context?.mode === "personal" && (
        <InfoAlert
          title="Osobní režim"
          description={
            <span>
              Týmové funkce vyžadují školu.{" "}
              <Link className="font-semibold text-emerald-700 underline" href="/app/onboarding">
                Založit nebo se připojit
              </Link>
            </span>
          }
        />
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner label="Načítám testy" />
      ) : fetchError ? null : isStudent ? (
        /* Student view — table with assignment status */
        filteredTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 py-16 px-6 text-center">
            <h3 className="text-lg font-semibold text-slate-900">Žádné přiřazené testy</h3>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Zatím ti nebyl přiřazen žádný test. Kontaktuj svého učitele.
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredTests}
            columns={studentColumnsWithStatus}
            loading={loading}
            onRowClick={(test) => router.push(studentAssignmentTargetHref(test.id, studentAssignmentsByTestId[test.id]))}
          />
        )
      ) : (
        /* Teacher / Director view — 3 sections */
        filteredTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 py-16 px-6 text-center">
            <h3 className="text-lg font-semibold text-slate-900">Zatím nemáš žádné testy</h3>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Vytvoř první test a přiřaď ho třídě.
            </p>
            <Link
              href="/app/tests/create"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              + Vytvořit test
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <Section title="Koncepty" count={draftTests.length} emptyMessage="Žádné koncepty">
              {draftTests.map((test) => (
                <TestRow
                  key={test.id}
                  test={test}
                  onPublish={handlePublish}
                  onArchive={handleArchive}
                  onAssign={(id) => { setAssignTestId(id); setAssignModalOpen(true); }}
                  loadingId={loadingId}
                  {...(isDirector ? { showCreator: true as const } : {})}
                />
              ))}
            </Section>

            <Section title="Publikované" count={publishedTests.length} emptyMessage="Žádné publikované testy">
              {publishedTests.map((test) => (
                <TestRow
                  key={test.id}
                  test={test}
                  onPublish={handlePublish}
                  onArchive={handleArchive}
                  onAssign={(id) => { setAssignTestId(id); setAssignModalOpen(true); }}
                  loadingId={loadingId}
                  {...(isDirector ? { showCreator: true as const } : {})}
                />
              ))}
            </Section>

            <Section title="Archiv" count={archivedTests.length} emptyMessage="Archiv je prázdný">
              {archivedTests.map((test) => (
                <TestRow
                  key={test.id}
                  test={test}
                  onPublish={handlePublish}
                  onArchive={handleArchive}
                  onAssign={(id) => { setAssignTestId(id); setAssignModalOpen(true); }}
                  loadingId={loadingId}
                  {...(isDirector ? { showCreator: true as const } : {})}
                />
              ))}
            </Section>
          </div>
        )
      )}

      <AssignToClassModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        testId={assignTestId}
        subjectId={tests.find((item) => item.id === assignTestId)?.subject?.id ?? null}
        allowedGrades={normalizeAllowedGrades(tests.find((item) => item.id === assignTestId)?.allowedGrades)}
        yearId={selectedYearId}
        onSuccess={() => void refetchTests()}
      />
    </div>
  );
}

export default withGuard({
  requirePerms: [
    PermissionKey.CREATE_TEST,
    PermissionKey.EDIT_TEST,
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
  ],
})(TestsPage);
