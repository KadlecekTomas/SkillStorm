"use client";

import { useEffect, useState } from "react";
import { withPermission } from "@/components/access/with-permission";
import { PermissionKey } from "@/types";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/utils/api-client";

type AnalyticsItem = {
  category: string;
  action: string;
  count: number;
};

function AnalyticsPage() {
  const [items, setItems] = useState<AnalyticsItem[]>([]);

  useEffect(() => {
    apiClient
      .get<{ items: AnalyticsItem[] }>("/analytics/summary")
      .then(({ data }) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <Card className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
      <div>
        <p className="text-sm text-slate-500">Analytics</p>
        <h2 className="text-xl font-semibold text-slate-900">Top interactions</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Category</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Action</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={`${item.category}-${item.action}`}>
                <td className="px-4 py-2 text-slate-700">{item.category}</td>
                <td className="px-4 py-2 text-slate-700">{item.action}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">
                  {item.count}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-slate-500">
                  Zatím žádné události.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default withPermission(PermissionKey.VIEW_ANALYTICS)(AnalyticsPage);
