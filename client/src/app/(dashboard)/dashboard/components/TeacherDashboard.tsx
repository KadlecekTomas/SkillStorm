"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TestCard } from "@/components/cards/test-card";
import { OverviewCard } from "@/components/cards/overview-card";
import { httpClient } from "@/lib/http/client";
import type { TestSummary } from "@/types";
import { getDashboardTeacher, type TeacherDashboardResponse } from "@/lib/api/dashboard";
import { BookOpenCheck, NotebookTabs, Users2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionKey } from "@/types";

const EMPTY_TESTS = "Nevytvořil/a jsi žádné testy.";
const EMPTY_ACTIVITY = "Zatím žádné aktivity.";

export function TeacherDashboard(): React.JSX.Element {
  const router = useRouter();
  const { can } = usePermissions();
  const canManageTests = can(PermissionKey.CREATE_TEST) || can(PermissionKey.EDIT_TEST);

  const [teacherData, setTeacherData] = useState<TeacherDashboardResponse | null>(null);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [testsLoading, setTestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDashboardTeacher()
      .then((res) => {
        if (!cancelled) setTeacherData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nepodařilo se načíst data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canManageTests) return;
    let cancelled = false;
    setTestsLoading(true);
    httpClient
      .get<TestSummary[]>("/tests")
      .then((data) => {
        if (!cancelled) setTests(Array.isArray(data) && data.length > 0 ? data : []);
      })
      .catch(() => {
        if (!cancelled) setTests([]);
      })
      .finally(() => {
        if (!cancelled) setTestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageTests]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <LoadingSpinner label="Načítání..." />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert title="Chyba načítání dat" description={error} variant="warning" />;
  }

  if (!teacherData) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <LoadingSpinner label="Načítání..." />
          </Card>
        ))}
      </div>
    );
  }

  const studentsCount = teacherData.studentsCount ?? 0;
  const classroomsCount = teacherData.classroomsCount ?? 0;
  const testsCreated = teacherData.testsCreated ?? 0;
  const pendingSubmissions = teacherData.pendingSubmissions ?? 0;
  const avgScoreOnMyTests = teacherData.avgScoreOnMyTests;
  const activity = teacherData.recentActivity ?? [];

  const assessmentsDelta =
    pendingSubmissions > 0
      ? `${pendingSubmissions} čeká na vyhodnocení`
      : "Všechny vyhodnocené";
  const avgScoreLabel =
    avgScoreOnMyTests != null ? `${Math.round(avgScoreOnMyTests)}%` : "—";

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          title="Active learners"
          value={String(studentsCount)}
          delta={`${classroomsCount} tříd`}
          icon={<Users2 className="h-5 w-5" />}
        />
        <OverviewCard
          title="Assessments"
          value={String(testsCreated)}
          delta={assessmentsDelta}
          icon={<NotebookTabs className="h-5 w-5" />}
          accent="bg-blue-50 text-blue-600"
        />
        <OverviewCard
          title="Průměrné skóre"
          value={avgScoreLabel}
          delta={`${classroomsCount} tříd`}
          icon={<BookOpenCheck className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {canManageTests && (
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Moje testy</p>
              <p className="text-lg font-semibold text-slate-900">Přehled a průměry</p>
            </div>
            {testsLoading ? (
              <LoadingSpinner label="Načítám testy" className="py-8" />
            ) : tests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {tests.map((test) => (
                  <TestCard
                    key={test.id}
                    test={test}
                    onView={(testId) => router.push(`/dashboard/tests?test=${testId}`)}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">{EMPTY_TESTS}</p>
            )}
          </Card>
        )}

        <Card className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">Poslední aktivity</p>
            <p className="text-lg font-semibold text-slate-900">Odevzdání studentů</p>
          </div>
          {activity.length > 0 ? (
            <div className="space-y-2">
              {activity.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.testTitle}</p>
                    <p className="text-xs text-slate-500">
                      {item.studentName ?? "Anonymní student"} •{" "}
                      {item.submittedAt
                        ? new Date(item.submittedAt).toLocaleDateString("cs-CZ")
                        : "—"}
                    </p>
                  </div>
                  {item.score !== null ? (
                    <p className="text-sm font-semibold text-slate-900">
                      {Math.round(item.score)}%
                    </p>
                  ) : (
                    <Badge variant="neutral">Čeká na vyhodnocení</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">{EMPTY_ACTIVITY}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
