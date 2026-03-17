"use client";

import { useEffect, useState } from "react";
import { PermissionKey } from "@/types";
import { Card } from "@/components/ui/card";
import { httpClient } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";
import { useAcademicYears } from "@/hooks/use-academic-years";
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

type TimelineItem = {
  submissionId: string;
  assignmentId: string;
  testTitle: string;
  submittedAt: string | null;
  score: number | null;
  maxPoints: number | null;
  percentage: number | null;
  status: string;
  attemptNo: number;
  openAt: string;
  closeAt: string;
};

function StudentTimelinePage() {
  const { selectedYearId } = useAcademicYears();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedYearId) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    httpClient
      .get<{ items: TimelineItem[] }>(
        `/analytics/student-timeline?yearId=${encodeURIComponent(selectedYearId)}`,
      )
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedYearId]);

  const chartData = items
    .filter((i) => i.submittedAt)
    .map((i) => ({
      label: i.testTitle.slice(0, 20) + (i.testTitle.length > 20 ? "…" : ""),
      score: i.percentage != null ? Math.round(i.percentage) : 0,
      date: i.submittedAt
        ? new Date(i.submittedAt).toLocaleDateString("cs-CZ", {
            month: "short",
            day: "numeric",
          })
        : "",
    }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Sprint 3</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Student timeline
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Časová osa odevzdání a skóre v daném školním roce.
        </p>
      </div>

      {!selectedYearId && (
        <Card className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6">
          <p className="text-sm text-amber-800">
            Vyberte školní rok pro zobrazení timeline.
          </p>
        </Card>
      )}

      {selectedYearId && loading && (
        <Card className="rounded-3xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Načítám…</p>
        </Card>
      )}

      {selectedYearId && !loading && items.length > 0 && (
        <>
          <Card className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="mb-4 text-sm font-medium text-slate-700">
              Skóre v čase
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "#E5E7EB",
                    }}
                  />
                  <Bar dataKey="score" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="mb-4 text-sm font-medium text-slate-700">
              Tabulka odevzdání
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Test
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Odevzdáno
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">
                      Skóre
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Stav
                    </th>
                    <th className="px-4 py-2 text-center font-medium text-slate-600">
                      Pokus
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((i) => (
                    <tr key={i.submissionId}>
                      <td className="px-4 py-2 text-slate-700">
                        {i.testTitle}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {i.submittedAt
                          ? new Date(i.submittedAt).toLocaleString("cs-CZ")
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {i.score != null
                          ? i.maxPoints != null && i.maxPoints > 0
                            ? `${i.score} / ${i.maxPoints} (${Math.round(i.percentage ?? (i.score / i.maxPoints) * 100)} %)`
                            : `${Math.round(i.percentage ?? 0)} %`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{i.status}</td>
                      <td className="px-4 py-2 text-center">{i.attemptNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {selectedYearId && !loading && items.length === 0 && (
        <Card className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Zatím žádná odevzdání v tomto školním roce.
          </p>
        </Card>
      )}
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.VIEW_RESULTS],
  requireSchoolWorkspace: true,
})(StudentTimelinePage);
