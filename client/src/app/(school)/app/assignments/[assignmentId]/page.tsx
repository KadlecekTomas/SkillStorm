"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { ErrorAlert, InfoAlert, WarningAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";
import { formatDate } from "@/lib/format-date";

type Assignment = {
  id: string;
  testId: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
};

type AssignmentSummary = {
  id: string;
  attemptsUsed: number;
  submissionId: string | null;
};

type TestDetail = {
  id: string;
  title: string;
  description?: string | null;
  questions: Array<{ id: string }>;
};

function AssignmentLauncherPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const router = useRouter();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const focusHref = `/app/assignments/${assignmentId}/test`;

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [assignmentData, summaries] = await Promise.all([
          fetchWithAuth<Assignment>("GET", `/assignments/${assignmentId}`),
          fetchWithAuth<AssignmentSummary[]>("GET", "/assignments/my").catch(
            () => [] as AssignmentSummary[],
          ),
        ]);
        if (!active) return;
        if (!assignmentData) {
          setError("Zadání nebylo nalezeno.");
          return;
        }
        setAssignment(assignmentData);
        const found =
          (summaries ?? []).find((item) => item.id === assignmentId) ?? null;
        setSummary(found);
        if (found?.submissionId) {
          router.replace(`/app/results/${found.submissionId}`);
          return;
        }
        const testData = await fetchWithAuth<TestDetail>(
          "GET",
          `/tests/${assignmentData.testId}`,
        );
        if (!active) return;
        setTest(testData);
      } catch {
        if (active) setError("Nepodařilo se načíst zadání.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [assignmentId, router]);

  const windowState = useMemo(() => {
    if (!assignment) return "loading" as const;
    const now = Date.now();
    if (now < new Date(assignment.openAt).getTime()) return "upcoming" as const;
    if (now > new Date(assignment.closeAt).getTime()) return "closed" as const;
    const exhausted =
      (summary?.attemptsUsed ?? 0) >= assignment.maxAttempts;
    return exhausted ? ("exhausted" as const) : ("open" as const);
  }, [assignment, summary]);

  if (loading) return <LoadingSpinner label="Načítám zadání" />;
  if (error) return <ErrorAlert title="Chyba" description={error} />;
  if (!assignment || !test)
    return <ErrorAlert title="Chyba" description="Zadání se nepodařilo načíst" />;
  if (summary?.submissionId) return <LoadingSpinner label="Načítám výsledek" />;

  const startTest = (): void => {
    router.push(focusHref);
  };
  const openInTab = (): void => {
    window.open(focusHref, "_blank", "noopener");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{test.title}</h1>
        {test.description && (
          <p className="mt-1 text-sm text-slate-600">{test.description}</p>
        )}
      </div>

      <Card className="space-y-4 p-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Počet otázek</dt>
            <dd className="font-medium">{test.questions?.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Pokusy</dt>
            <dd className="font-medium">
              {summary?.attemptsUsed ?? 0} / {assignment.maxAttempts}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Otevřeno</dt>
            <dd className="font-medium">{formatDate(assignment.openAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Uzavřeno</dt>
            <dd className="font-medium">{formatDate(assignment.closeAt)}</dd>
          </div>
        </dl>

        {windowState === "open" && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              Test se otevře v testovacím režimu bez rušivých prvků. Odpovědi se
              průběžně automaticky ukládají.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={startTest} data-testid="start-test">
                Spustit test
              </Button>
              <Button type="button" variant="outline" onClick={openInTab}>
                Otevřít v testovacím režimu (nová záložka)
              </Button>
            </div>
          </div>
        )}

        {windowState === "upcoming" && (
          <InfoAlert
            title="Test ještě není otevřený"
            description={`Zpřístupní se ${formatDate(assignment.openAt)}.`}
          />
        )}
        {windowState === "closed" && (
          <WarningAlert
            title="Test je uzavřený"
            description="Okno pro odevzdání už skončilo."
          />
        )}
        {windowState === "exhausted" && (
          <WarningAlert
            title="Vyčerpané pokusy"
            description="Využil jsi všechny dostupné pokusy pro tento test."
          />
        )}
      </Card>
    </div>
  );
}

const studentOnly: OrganizationRole[] = ["STUDENT"];

export default withGuard({
  requireRoles: studentOnly,
  requireSchoolWorkspace: true,
})(AssignmentLauncherPage);
