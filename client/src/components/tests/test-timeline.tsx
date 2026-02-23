"use client";

import { Card } from "@/components/ui/card";

export type TestTimelineItem = {
  submissionId: string;
  assignmentId: string;
  testTitle: string;
  submittedAt: string | null;
  score: number | null;
  status: string;
  attemptNo: number;
};

export type TestTimelineProps = {
  items: TestTimelineItem[];
};

export function TestTimeline({ items }: TestTimelineProps) {
  if (items.length === 0) {
    return (
      <Card className="rounded-2xl border border-slate-200 p-6">
        <p className="text-sm text-slate-500">
          Zatím žádná odevzdání v tomto období.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">
                Datum
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">
                Test
              </th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">
                Skóre
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">
                Stav
              </th>
              <th className="px-4 py-2 text-center font-medium text-slate-500">
                Pokus
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.submissionId}>
                <td className="px-4 py-2 text-slate-600">
                  {item.submittedAt
                    ? new Date(item.submittedAt).toLocaleString("cs-CZ", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {item.testTitle}
                </td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">
                  {item.score != null
                    ? `${Math.round(item.score * 100)} %`
                    : "—"}
                </td>
                <td className="px-4 py-2 text-slate-600">{item.status}</td>
                <td className="px-4 py-2 text-center text-slate-600">
                  {item.attemptNo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
