"use client";

import { TestListRow } from "./test-list-row";

export type TestListItem = {
  assignmentId: string;
  testId?: string;
  testTitle: string;
  subjectName?: string | null;
  status: "done" | "open";
  lastScore?: number | null;
  lastMaxScore?: number | null;
  lastPercentage?: number | null;
};

export type TestListProps = {
  items: TestListItem[];
  onOpenTest?: (assignmentId: string) => void;
  onViewResult?: (assignmentId: string) => void;
};

export function TestList({
  items,
  onOpenTest,
  onViewResult,
}: TestListProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">Žádná zadání k zobrazení.</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-1">
      {items.map((item) => (
        <TestListRow
          key={item.assignmentId}
          assignmentId={item.assignmentId}
          testTitle={item.testTitle}
          subjectName={item.subjectName ?? null}
          status={item.status}
          lastScore={item.lastScore ?? null}
          lastMaxScore={item.lastMaxScore ?? null}
          lastPercentage={item.lastPercentage ?? null}
          {...(onOpenTest !== undefined ? { onOpen: onOpenTest } : {})}
          {...(onViewResult !== undefined ? { onViewResult } : {})}
        />
      ))}
    </div>
  );
}
