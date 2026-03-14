"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TestCard } from "@/components/cards/test-card";
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
import { useTestAssignments } from "@/hooks/use-test-assignments";
import { useSubjects, subjectLabel } from "@/hooks/use-subjects";
import type { Subject } from "@/types";
import { formatPercent, formatInt } from "@/utils/format";
import { ALL_SCHOOL_GRADES, gradeLabel, normalizeAllowedGrades } from "@/lib/grades";

/** API can return items with creator for director filter */
type TestListItem = TestSummary & { creator?: { user?: { name?: string | null } } };

function allowedGradesText(row: TestSummary): string {
  return normalizeAllowedGrades(row.allowedGrades).map(gradeLabel).join(", ");
}

type EffectiveAssignmentStatus = "UPCOMING" | "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED" | "NO_ATTEMPTS_LEFT";

type MyAssignment = {
  id: string;
  testId: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
  attemptsUsed: number;
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

function subjectColumnRender(row: TestSummary): string {
  const sub = row.subject;
  if (!sub || typeof sub !== "object") return "—";
  return sub.name;
}

const baseColumns: Column<TestSummary>[] = [
  { key: "title", label: "Test" },
  { key: "subject", label: "Předmět", render: subjectColumnRender },
  {
    key: "allowedGrades",
    label: "Ročníky",
    render: (row) => allowedGradesText(row),
  },
  {
    key: "avgScore",
    label: "Průměr",
    render: (row) => formatPercent(row.avgScore),
  },
  {
    key: "completionRate",
    label: "Dokončeno",
    render: (row) => formatPercent(row.completionRate),
  },
  {
    key: "submissions",
    label: "Odevzdání",
    render: (row) => formatInt(row.submissions),
  },
];

function TestsPage(): React.JSX.Element {
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTestId, setAssignTestId] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [subjectFilterId, setSubjectFilterId] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [studentAssignments, setStudentAssignments] = useState<MyAssignment[]>([]);
  const router = useRouter();
  const { org, context, user } = useAuth();
  const { selectedYearId } = useAcademicYears();
  const { byTestId: assignmentByTestId } = useTestAssignments(selectedYearId);
  const { subjects: orgSubjects } = useSubjects();

  const isDirector = user?.organizationRole === "DIRECTOR" || user?.organizationRole === "OWNER";
  const isStudent = user?.organizationRole === "STUDENT";

  const fetchTests = useCallback(async () => {
    try {
      const data = await fetchWithAuth<{ items?: TestListItem[] } | TestListItem[]>("GET", "/tests", {
        query: {
          ...(subjectFilterId ? { subjectId: subjectFilterId } : {}),
          ...(gradeFilter ? { grade: gradeFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
        },
      });
      const list = data && typeof data === "object" && "items" in data
        ? (data as { items: TestListItem[] }).items ?? []
        : Array.isArray(data) ? data : [];
      setTests(
        (Array.isArray(list) ? list : []).map((item) => ({
          ...item,
          allowedGrades: normalizeAllowedGrades(item.allowedGrades),
        })),
      );
      setFetchError(false);
    } catch {
      setTests([]);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [gradeFilter, selectedYearId, statusFilter, subjectFilterId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
      setFetchError(false);
    fetchTests().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [org?.id, fetchTests]);

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
      .catch(() => { /* non-fatal — status badges just won't show */ });
    return () => { cancelled = true; };
  }, [isStudent, org?.id]);

  const teachers = useMemo(() => {
    const names = new Set<string>();
    tests.forEach((t) => {
      const name = (t as TestListItem).creator?.user?.name?.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [tests]);

  const filteredTests = useMemo(() => {
    let list = tests;
    if (teacherFilter) {
      list = list.filter((t) => (t as TestListItem).creator?.user?.name?.trim() === teacherFilter);
    }
    if (subjectFilterId) {
      list = list.filter((t) => (t.subject && typeof t.subject === "object" && (t.subject as Subject).id === subjectFilterId));
    }
    if (gradeFilter) {
      list = list.filter((t) => normalizeAllowedGrades(t.allowedGrades).includes(gradeFilter));
    }
    if (statusFilter) {
      list = list.filter((t) => t.status === statusFilter);
    }
    return list;
  }, [gradeFilter, statusFilter, subjectFilterId, teacherFilter, tests]);

  const studentAssignmentsByTestId = useMemo(() => {
    const map: Record<string, MyAssignment> = {};
    for (const a of studentAssignments) {
      const existing = map[a.testId];
      if (!existing) {
        map[a.testId] = a;
        continue;
      }
      // Prefer open assignment; otherwise latest closeAt
      const now = Date.now();
      const aIsOpen = new Date(a.openAt).getTime() <= now && new Date(a.closeAt).getTime() > now;
      const exIsOpen = new Date(existing.openAt).getTime() <= now && new Date(existing.closeAt).getTime() > now;
      if (aIsOpen && !exIsOpen) { map[a.testId] = a; continue; }
      if (!aIsOpen && exIsOpen) continue;
      if (new Date(a.closeAt).getTime() > new Date(existing.closeAt).getTime()) map[a.testId] = a;
    }
    return map;
  }, [studentAssignments]);

  const columns: Column<TestSummary>[] = useMemo(() => {
    if (isStudent) {
      return [
        { key: "title", label: "Test" },
        { key: "subject", label: "Předmět", render: subjectColumnRender },
        {
          key: "allowedGrades",
          label: "Ročníky",
          render: (row) => allowedGradesText(row),
        },
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
      ];
    }
    if (!isDirector) return baseColumns;

    return [
      { key: "title", label: "Test" },
      { key: "subject", label: "Předmět", render: subjectColumnRender },
      {
        key: "allowedGrades",
        label: "Ročníky",
        render: (row) => allowedGradesText(row),
      },
      {
        key: "creator",
        label: "Vytvořil",
        render: (row) => (row as TestListItem).creator?.user?.name ?? "—",
      },
      {
        key: "assignmentCount",
        label: "Počet přiřazení",
        render: (row) => assignmentByTestId[row.id]?.count ?? 0,
      },
      {
        key: "activeAssignments",
        label: "Aktivní přiřazení",
        render: (row) => assignmentByTestId[row.id]?.activeCount ?? 0,
      },
      {
        key: "pendingEvaluation",
        label: "Čeká na vyhodnocení",
        render: () => "—",
      },
      {
        key: "avgScore",
        label: "Průměr",
        render: (row) => formatPercent(row.avgScore),
      },
      {
        key: "completionRate",
        label: "Dokončeno",
        render: (row) => formatPercent(row.completionRate),
      },
      {
        key: "submissions",
        label: "Odevzdání",
        render: (row) => formatInt(row.submissions),
      },
    ];
  }, [isStudent, isDirector, assignmentByTestId, studentAssignmentsByTestId]);

  const handleOpenAssign = (testId: string) => {
    setAssignTestId(testId);
    setAssignModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {fetchError && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-600">Chyba načítání</p>
          <p className="mt-0.5 text-slate-600">Seznam testů se nepovedlo načíst.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void fetchTests()}>
            Zkusit znovu
          </Button>
        </div>
      )}
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
        {!isStudent && (
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-slate-700">Stav:</label>
            <select
              id="status-filter"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Všechny</option>
              <option value="DRAFT">Koncept</option>
              <option value="PUBLISHED">Publikováno</option>
              <option value="ARCHIVED">Archivováno</option>
            </select>
          </div>
        )}
      </div>
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
      {loading ? (
        <LoadingSpinner label="Načítám testy" />
      ) : fetchError ? (
        null
      ) : filteredTests.length > 0 ? (
        <>
          {!isStudent && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTests.slice(0, 3).map((test) => (
                <TestCard
                  key={test.id}
                  test={test}
                  assignmentSummary={assignmentByTestId[test.id] ?? null}
                  onAssign={handleOpenAssign}
                  onStatusChange={fetchTests}
                />
              ))}
            </div>
          )}
          <DataTable
            data={filteredTests}
            columns={columns}
            loading={loading}
            onRowClick={isStudent ? (test) => router.push(`/app/tests/${test.id}`) : undefined}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 py-16 px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-slate-500">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          {isStudent ? (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Žádné přiřazené testy</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Zatím ti nebyl přiřazen žádný test. Kontaktuj svého učitele.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
      <AssignToClassModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        testId={assignTestId}
        allowedGrades={normalizeAllowedGrades(tests.find((item) => item.id === assignTestId)?.allowedGrades)}
        yearId={selectedYearId}
        onSuccess={fetchTests}
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
