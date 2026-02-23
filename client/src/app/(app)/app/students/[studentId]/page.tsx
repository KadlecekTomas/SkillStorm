"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useStudentDetail } from "@/hooks/use-student-detail";
import { withGuard } from "@/lib/guard/withGuard";

function StudentDetailPageContent(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const studentId = typeof params.studentId === "string" ? params.studentId : null;
  const { detail, loading, error } = useStudentDetail(studentId);

  if (!studentId) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Neplatné ID žáka.</p>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Link
          href="/app/classrooms"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Zpět na třídu
        </Link>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Žák nenalezen.</p>
      </div>
    );
  }

  const { displayName, classroomLabel, performanceSummary, progressByTopic, recentTests } = detail;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/app/classrooms"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Zpět na třídu
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{displayName}</h1>
          <p className="mt-1 text-sm text-slate-600">Třída: {classroomLabel}</p>
        </div>
        <Badge variant="secondary" className="text-base">
          Průměr: {performanceSummary.averageScore.toFixed(1)} %
        </Badge>
      </header>

      <section>
        <h2 className="text-lg font-medium text-slate-800 mb-3">Přehled výkonu</h2>
        <Card className="p-4 rounded-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-500">Průměrné skóre</p>
              <p className="text-xl font-semibold text-slate-900">
                {performanceSummary.averageScore.toFixed(1)} %
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Dokončené testy</p>
              <p className="text-xl font-semibold text-slate-900">
                {performanceSummary.completedTests}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Poslední aktivita</p>
              <p className="text-slate-900">
                {performanceSummary.lastActivityAt
                  ? new Date(performanceSummary.lastActivityAt).toLocaleDateString("cs-CZ")
                  : "—"}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {progressByTopic.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-slate-800 mb-3">Pokrok podle témat</h2>
          <Card className="p-4 rounded-2xl">
            <ul className="space-y-2">
              {progressByTopic.map((t) => (
                <li
                  key={t.topicId}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-800">{t.topicName}</span>
                  <span className="font-medium text-slate-900">
                    {t.averageScore.toFixed(1)} %
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium text-slate-800 mb-3">Nedávné testy</h2>
        {recentTests.length > 0 ? (
          <Card className="overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-600">
                  <th className="px-4 py-3 font-medium">Test</th>
                  <th className="px-4 py-3 font-medium">Skóre</th>
                  <th className="px-4 py-3 font-medium">Odevzdáno</th>
                </tr>
              </thead>
              <tbody>
                {recentTests.map((t) => (
                  <tr key={`${t.testId}-${t.submittedAt ?? ""}`} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-900">{t.title}</td>
                    <td className="px-4 py-3">
                      {t.score != null && t.maxScore != null
                        ? `${t.score} / ${t.maxScore}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.submittedAt
                        ? new Date(t.submittedAt).toLocaleDateString("cs-CZ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <Card className="p-6 rounded-2xl text-center text-slate-500">
            Zatím žádné odevzdané testy.
          </Card>
        )}
      </section>
    </div>
  );
}

function StudentDetailPage(): React.JSX.Element {
  return <StudentDetailPageContent />;
}

export default withGuard({ requireSchoolWorkspace: true })(StudentDetailPage);
