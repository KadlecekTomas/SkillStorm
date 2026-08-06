"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { httpClient } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";
import { useAcademicYears } from "@/hooks/use-academic-years";
import type { OrganizationRole } from "@/types";

type HeatmapItem = {
  classSectionId: string;
  grade: string;
  section: string;
  assignmentId: string;
  testTitle: string;
  /** Backend returns a percentage in the 0..100 range. */
  avgScore: number | null;
  submissionCount: number;
  totalStudents: number;
};

const LEADERSHIP_ROLES: OrganizationRole[] = ["OWNER", "DIRECTOR"];

function ClassHeatmapPage() {
  const { selectedYearId } = useAcademicYears();
  const [items, setItems] = useState<HeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedYearId) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    httpClient
      .get<{ items: HeatmapItem[] }>(
        `/analytics/class-heatmap?yearId=${encodeURIComponent(selectedYearId)}`,
      )
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedYearId]);

  const gradeLabels: Record<string, string> = {
    GRADE_1: "1.",
    GRADE_2: "2.",
    GRADE_3: "3.",
    GRADE_4: "4.",
    GRADE_5: "5.",
    GRADE_6: "6.",
    GRADE_7: "7.",
    GRADE_8: "8.",
    GRADE_9: "9.",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Přehled výsledků tříd
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Agregované skóre po třídách a zadáních bez jmen žáků.
        </p>
      </div>

      {!selectedYearId && (
        <Card className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6">
          <p className="text-sm text-amber-800">
            Vyberte školní rok pro zobrazení přehledu.
          </p>
        </Card>
      )}

      {selectedYearId && loading && (
        <Card className="rounded-3xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Načítám…</p>
        </Card>
      )}

      {selectedYearId && !loading && (
        <Card className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="mb-4 text-sm font-medium text-slate-700">
            Průměrné skóre a počet odevzdání
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">
                    Třída
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">
                    Test
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">
                    Průměr skóre
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">
                    Odevzdání
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">
                    Žáků
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((i) => (
                  <tr key={`${i.classSectionId}-${i.assignmentId}`}>
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {gradeLabels[i.grade] ?? i.grade} {i.section}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{i.testTitle}</td>
                    <td className="px-4 py-2 text-right">
                      {i.avgScore != null
                        ? `${Math.round(i.avgScore)} %`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">{i.submissionCount}</td>
                    <td className="px-4 py-2 text-right">
                      {i.totalStudents}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                Zatím žádná data pro tento školní rok.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export default withGuard({
  requireRoles: LEADERSHIP_ROLES,
  requireSchoolWorkspace: true,
})(ClassHeatmapPage);
