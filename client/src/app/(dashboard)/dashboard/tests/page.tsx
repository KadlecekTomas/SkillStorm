"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TestCard } from "@/components/cards/test-card";
import { DataTable, type Column } from "@/components/ui/table";
import type { TestSummary } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import Link from "next/link";
import { PermissionKey } from "@/types";
import { AssignToClassModal } from "@/components/tests/AssignToClassModal";
import { useTestAssignments } from "@/hooks/use-test-assignments";

/** API can return items with creator for director filter */
type TestListItem = TestSummary & { creator?: { user?: { name?: string | null } } };

const baseColumns: Column<TestSummary>[] = [
  { key: "title", label: "Test" },
  { key: "subject", label: "Subject" },
  {
    key: "avgScore",
    label: "Avg Score",
    render: (row) => `${row.avgScore}%`,
  },
  {
    key: "completionRate",
    label: "Completion",
    render: (row) => `${row.completionRate}%`,
  },
  { key: "submissions", label: "Submissions" },
];

const studentColumns: Column<TestSummary>[] = [
  { key: "title", label: "Test" },
  { key: "subject", label: "Subject" },
];

function TestsPage(): React.JSX.Element {
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTestId, setAssignTestId] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const { org, context, user } = useAuth();
  const { selectedYearId } = useAcademicYears();
  const { byTestId: assignmentByTestId } = useTestAssignments(selectedYearId);

  const isDirector = user?.organizationRole === "DIRECTOR" || user?.organizationRole === "OWNER";
  const isStudent = user?.organizationRole === "STUDENT";

  const fetchTests = useCallback(async () => {
    try {
      const data = await fetchWithAuth<{ items?: TestListItem[] } | TestListItem[]>("GET", "/tests");
      const list = data && typeof data === "object" && "items" in data
        ? (data as { items: TestListItem[] }).items ?? []
        : Array.isArray(data) ? data : [];
      setTests(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to fetch tests:", error);
      setTests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTests().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [org?.id, fetchTests]);

  const teachers = useMemo(() => {
    const names = new Set<string>();
    tests.forEach((t) => {
      const name = (t as TestListItem).creator?.user?.name?.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [tests]);

  const filteredTests = useMemo(() => {
    if (!teacherFilter) return tests;
    return tests.filter((t) => (t as TestListItem).creator?.user?.name?.trim() === teacherFilter);
  }, [tests, teacherFilter]);

  const columns: Column<TestSummary>[] = useMemo(() => {
    if (isStudent) return studentColumns;
    if (!isDirector) return baseColumns;
    return [
      { key: "title", label: "Test" },
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
        label: "Avg Score",
        render: (row) => `${row.avgScore}%`,
      },
      {
        key: "completionRate",
        label: "Completion",
        render: (row) => `${row.completionRate}%`,
      },
      { key: "submissions", label: "Submissions" },
    ];
  }, [isStudent, isDirector, assignmentByTestId]);

  const handleOpenAssign = (testId: string) => {
    setAssignTestId(testId);
    setAssignModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {isDirector ? "Testy v organizaci" : isStudent ? "Přiřazené testy" : "Moje testy"}
          </h2>
          <p className="text-sm text-slate-500">
            {isDirector
              ? "Všechny testy a přiřazení. Filtruj podle učitele."
              : isStudent
              ? "Testy přiřazené tvé třídě."
              : "Přehled testů, odevzdání a průměry."}
          </p>
        </div>
        {!isStudent && (
          <Link
            href="/dashboard/tests/create"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            + Vytvořit test
          </Link>
        )}
      </div>
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
      {context?.mode === "personal" && (
        <Alert
          title="Osobní režim"
          description={
            <span>
              Týmové funkce vyžadují školu.{" "}
              <Link className="font-semibold text-emerald-700 underline" href="/dashboard/onboarding">
                Založit nebo se připojit
              </Link>
            </span>
          }
        />
      )}
      {!loading && filteredTests.length > 0 && !isStudent && (
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
      {loading ? (
        <LoadingSpinner label="Načítám testy" />
      ) : filteredTests.length > 0 ? (
        <DataTable data={filteredTests} columns={columns} loading={loading} />
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
                href="/dashboard/tests/create"
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
        allowedGrades={tests.find((item) => item.id === assignTestId)?.allowedGrades ?? []}
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
