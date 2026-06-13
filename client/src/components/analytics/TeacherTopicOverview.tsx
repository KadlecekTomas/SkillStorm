"use client";

import type { TrendLabel, TeacherTopicAnalyticsItem } from "@/types/analytics";
import { Card } from "@/components/ui/card";

type Props = {
  items: TeacherTopicAnalyticsItem[];
};

const trendLabelToText = (trend: TrendLabel): string => {
  if (trend === "BETTER") return "lepší než dříve";
  if (trend === "WORSE") return "horší než dříve";
  return "beze změny";
};

export function TeacherTopicOverview({ items }: Props): React.JSX.Element {
  return (
    <Card className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-soft">
      <div>
        <p className="text-sm text-slate-500">Témata třídy</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Téma</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">
                Průměrná úspěšnost
              </th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">
                Rozptyl
              </th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.topicId}>
                <td className="px-4 py-2 text-slate-800">{item.topicName}</td>
                <td className="px-4 py-2 text-right text-slate-800">
                  {(item.avgSuccess * 100).toFixed(0)} %
                </td>
                <td className="px-4 py-2 text-right text-slate-700">
                  {item.dispersionLabel}
                </td>
                <td className="px-4 py-2 text-right text-slate-700">
                  {trendLabelToText(item.trend)}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-center text-slate-500">
                  Zatím nejsou dostupná žádná data pro třídu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

