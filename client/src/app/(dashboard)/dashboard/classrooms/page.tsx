"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/table";
import type { Classroom } from "@/types";
import { Alert } from "@/components/ui/alert";

const columns: Column<Classroom>[] = [
  {
    key: "label",
    label: "Classroom",
  },
  {
    key: "gradeLabel",
    label: "Grade",
    render: (row) => row.gradeLabel ?? row.grade,
  },
  {
    key: "teacherName",
    label: "Teacher",
    render: (row) => row.teacherName ?? "TBD",
  },
  {
    key: "studentsCount",
    label: "Students",
    render: (row) => row.studentsCount,
  },
  {
    key: "updatedAt",
    label: "Updated",
    render: (row) => row.updatedAt ?? "—",
  },
];

export default function ClassroomsPage(): React.JSX.Element {
  const [classrooms] = useState<Classroom[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Classrooms</h1>
          <p className="text-sm text-slate-500">
            Tato část UI zatím není napojená na backend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">NOT IMPLEMENTED</Badge>
          <Button disabled title="Správa tříd není implementovaná.">
            Create classroom
          </Button>
        </div>
      </div>
      <Alert
        title="Not implemented"
        description="Správa tříd přes UI není implementovaná. Použij API nebo seed."
        variant="warning"
      />
      <DataTable
        data={classrooms}
        columns={columns}
        loading={false}
        emptyState="Classrooms nejsou dostupné v UI."
      />
    </div>
  );
}
