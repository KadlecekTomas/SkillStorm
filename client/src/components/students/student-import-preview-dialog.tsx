"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  StudentImportCommitResponse,
  StudentImportPreviewResponse,
  StudentImportPreviewRow,
} from "@/lib/api/student-imports";
import { cn } from "@/utils/cn";
import { Trash2 } from "lucide-react";

type EditableStudentImportRow = StudentImportPreviewRow & {
  id: string;
};

type StudentImportPreviewDialogProps = {
  open: boolean;
  preview: StudentImportPreviewResponse | null;
  pending?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onCommit: (
    rows: Array<{
      firstName: string;
      lastName: string;
      email?: string;
      class: string;
    }>,
  ) => Promise<StudentImportCommitResponse | void>;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeClass(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function validateRows(
  rows: EditableStudentImportRow[],
  preview: StudentImportPreviewResponse | null,
): EditableStudentImportRow[] {
  if (!preview) return rows;

  const classSet = new Set(preview.meta.classOptions.map((option) => normalizeClass(option.label)));
  const reservedEmails = new Set(preview.meta.reservedEmails.map((email) => email.trim().toLowerCase()));
  const emailCounts = new Map<string, number>();

  rows.forEach((row) => {
    const email = row.email.trim().toLowerCase();
    if (!email) return;
    emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  });

  return rows.map((row) => {
    const errors: string[] = [];
    const firstName = row.firstName.trim();
    const lastName = row.lastName.trim();
    const email = row.email.trim().toLowerCase();
    const className = row.class.trim();

    if (!firstName) errors.push("Chybí jméno.");
    if (!lastName) errors.push("Chybí příjmení.");
    if (!email && !preview.meta.usernameModeEnabled) {
      errors.push("Email je povinný.");
    }
    if (email && !emailRegex.test(email)) {
      errors.push("Email nemá platný formát.");
    }
    if (email && (emailCounts.get(email) ?? 0) > 1) {
      errors.push("Duplicitní email v importu.");
    }
    if (email && reservedEmails.has(email)) {
      errors.push("Email už v systému existuje.");
    }
    if (!className) {
      errors.push("Chybí třída.");
    } else if (!classSet.has(normalizeClass(className))) {
      errors.push(`Třída "${className}" neexistuje.`);
    }

    return {
      ...row,
      status: errors.length > 0 ? "INVALID" : "VALID",
      errors,
    };
  });
}

export function StudentImportPreviewDialog({
  open,
  preview,
  pending = false,
  error,
  onOpenChange,
  onCommit,
}: StudentImportPreviewDialogProps): React.JSX.Element {
  const [rows, setRows] = useState<EditableStudentImportRow[]>([]);

  useEffect(() => {
    if (!preview) {
      setRows([]);
      return;
    }
    setRows(
      preview.rows.map((row) => ({
        ...row,
        id: `row-${row.rowNumber}`,
      })),
    );
  }, [preview]);

  const validatedRows = useMemo(() => validateRows(rows, preview), [preview, rows]);

  const summary = useMemo(() => {
    const invalidRows = validatedRows.filter((row) => row.status === "INVALID").length;
    return {
      totalRows: validatedRows.length,
      validRows: validatedRows.length - invalidRows,
      invalidRows,
    };
  }, [validatedRows]);

  const validRows = useMemo(
    () =>
      validatedRows
        .filter((row) => row.status === "VALID")
        .map((row) => ({
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          ...(row.email.trim() ? { email: row.email.trim() } : {}),
          class: row.class.trim(),
        })),
    [validatedRows],
  );

  const updateCell = (rowId: string, field: keyof Pick<EditableStudentImportRow, "firstName" | "lastName" | "email" | "class">, value: string) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  };

  const removeRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  const columns = useMemo<ColumnDef<EditableStudentImportRow>[]>(
    () => [
      {
        accessorKey: "firstName",
        header: "firstName",
        cell: ({ row }) => (
          <Input
            value={row.original.firstName}
            onChange={(event) => updateCell(row.original.id, "firstName", event.target.value)}
            className="min-w-28"
          />
        ),
      },
      {
        accessorKey: "lastName",
        header: "lastName",
        cell: ({ row }) => (
          <Input
            value={row.original.lastName}
            onChange={(event) => updateCell(row.original.id, "lastName", event.target.value)}
            className="min-w-32"
          />
        ),
      },
      {
        accessorKey: "email",
        header: "email",
        cell: ({ row }) => (
          <Input
            value={row.original.email}
            onChange={(event) => updateCell(row.original.id, "email", event.target.value)}
            className="min-w-52"
          />
        ),
      },
      {
        accessorKey: "class",
        header: "class",
        cell: ({ row }) => (
          <Input
            value={row.original.class}
            onChange={(event) => updateCell(row.original.id, "class", event.target.value)}
            className="min-w-28"
            list="student-import-class-options"
          />
        ),
      },
      {
        accessorKey: "status",
        header: "status",
        cell: ({ row }) => (
          <div className="min-w-40">
            <Badge variant={row.original.status === "VALID" ? "success" : "warning"}>
              {row.original.status === "VALID" ? "VALID" : "INVALID"}
            </Badge>
            {row.original.errors.length > 0 && (
              <p className="mt-2 text-xs text-red-600">
                {row.original.errors.join(" ")}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeRow(row.original.id)}
            aria-label={`Odstranit řádek ${row.original.rowNumber}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [preview],
  );

  const table = useReactTable({
    data: validatedRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Kontrola importu žáků</DialogTitle>
          <DialogDescription>
            Zkontroluj a případně uprav importovaná data před vytvořením účtů a zápisem do tříd.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Total rows</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.totalRows}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">Valid rows</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{summary.validRows}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">Invalid rows</p>
            <p className="mt-1 text-2xl font-semibold text-red-900">{summary.invalidRows}</p>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 bg-white">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn("border-b border-slate-100", row.original.status === "INVALID" && "bg-red-50/70")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <datalist id="student-import-class-options">
          {preview?.meta.classOptions.map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onCommit(validRows)}
            disabled={pending || validRows.length === 0}
          >
            {pending ? "Importuji…" : "Import valid rows"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
