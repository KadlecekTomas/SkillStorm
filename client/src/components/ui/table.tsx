"use client";

import { useMemo, useState } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";

export type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  emptyState?: React.ReactNode;
  loading?: boolean;
  onRowClick?: ((row: T) => void) | undefined;
};

const resolveValue = <T extends { id: string }>(row: T, column: Column<T>) => {
  if (column.render) return column.render(row);
  if (typeof column.key === "string") {
    return (row as Record<string, React.ReactNode>)[column.key] ?? null;
  }
  return row[column.key] as React.ReactNode;
};

export const DataTable = <T extends { id: string }>({
  data,
  columns,
  pageSize = 6,
  emptyState,
  loading,
  onRowClick,
}: DataTableProps<T>): React.JSX.Element => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const rows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  return (
    <div className="space-y-4">
      <div className="sm:hidden">
        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="h-4 animate-pulse rounded-full bg-slate-100" />
          </div>
        ) : rows.length ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <article
                key={row.id}
                className={cn(
                  "rounded-2xl border border-slate-100 bg-white p-4",
                  onRowClick && "cursor-pointer active:bg-slate-50",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <dl className="space-y-3">
                  {columns.map((column) => (
                    <div key={String(column.key)} className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {column.label}
                      </dt>
                      <dd className={cn("mt-1 min-w-0 text-sm text-slate-700", column.className)}>
                        {resolveValue(row, column)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-8 text-center text-slate-500">
            {emptyState ?? "Zatím tu nejsou žádná data."}
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white sm:block">
        <table className="w-full min-w-full divide-y divide-slate-100">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              {columns.map((column) => (
                <th key={String(column.key)} className="px-6 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8">
                  <div className="h-4 animate-pulse rounded-full bg-slate-100" />
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn("hover:bg-slate-50/70", onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={cn("px-6 py-4 text-slate-700", column.className)}
                    >
                      {resolveValue(row, column)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-10 text-center text-slate-500"
                >
                  {emptyState ?? "Zatím tu nejsou žádná data."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-2 text-sm">
          <span className="text-slate-500">
            Strana {page} z {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Předchozí
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Další
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
