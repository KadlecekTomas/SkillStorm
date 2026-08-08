"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
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
  avgScore: number | null;
  submissionCount: number;
  totalStudents: number;
};

const LEADERSHIP_ROLES: OrganizationRole[] = ["OWNER", "DIRECTOR"];

function ClassHeatmapPage(): React.JSX.Element {
  const { selectedYearId } = useAcademicYears();
  const [items, setItems] = useState<HeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedYearId) {
      setLoading(false);
      setItems([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await httpClient.get<{ items: HeatmapItem[] }>(
        `/analytics/class-heatmap?yearId=${encodeURIComponent(selectedYearId)}`,
      );
      setItems(data.items ?? []);
    } catch {
      setItems([]);
      setError("Přehled výsledků tříd se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <p className="text-sm text-slate-600">Načítám přehled tříd…</p>
        </Card>
      )}

      {selectedYearId && !loading && error && (
        <div className="space-y-3">
          <ErrorAlert title="Přehled nelze načíst" description={error} />
          <Button variant="outline" onClick={() => void load()}>
            Zkusit znovu
          </Button>
        </div>
      )}

      {selectedYearId && !loading && !error && (
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
                {items.map((item) => (
                  <tr key={`${item.classSectionId}-${item.assignmentId}`}>
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {gradeLabels[item.grade] ?? item.grade} {item.section}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {item.testTitle}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.avgScore != null
                        ? `${Math.round(item.avgScore)} %`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.submissionCount}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.totalStudents}
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
