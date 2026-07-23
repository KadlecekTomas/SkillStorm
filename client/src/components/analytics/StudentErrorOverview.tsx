"use client";

import type { TrendLabel, StudentErrorAnalyticsItem } from "@/types/analytics";
import { Card } from "@/components/ui/card";

type Props = {
  items: StudentErrorAnalyticsItem[];
};

const trendLabelToText = (trend: TrendLabel): string => {
  if (trend === "BETTER") return "lepší než dříve";
  if (trend === "WORSE") return "horší než dříve";
  return "beze změny";
};

export function StudentErrorOverview({ items }: Props): React.JSX.Element {
  return (
    <Card className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-soft">
      <div>
        <p className="text-sm text-slate-500">Moje typické chyby</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Chyba</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Četnost</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Podíl</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.errorCategoryId}>
                <td className="px-4 py-2 text-slate-800">{item.errorCategoryLabel}</td>
                <td className="px-4 py-2 text-right text-slate-800">{item.count}</td>
                <td className="px-4 py-2 text-right text-slate-700">
                  {(item.share * 100).toFixed(0)} %
                </td>
                <td className="px-4 py-2 text-right text-slate-700">
                  {trendLabelToText(item.trend)}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-center text-slate-500">
                  Zatím tu nic není. Data o chybách se objeví, až dokončíš první test.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

