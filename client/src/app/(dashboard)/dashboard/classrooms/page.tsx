"use client";

import { useEffect, useState } from "react";
import { ClassroomList } from "@/components/content/classroom-list";
import { BaseModal } from "@/components/modals/base-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/table";
import type { Classroom } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

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

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchWithAuth<Classroom[]>("GET", "/classrooms");
        setClassrooms(data ?? []);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setClassrooms((prev) => [
      {
        id: crypto.randomUUID(),
        label: newName,
        grade: "GRADE_CUSTOM",
        section: "A",
        gradeLabel: "Custom",
        teacherName: "Pending assignment",
        studentsCount: 0,
        updatedAt: "just now",
      },
      ...prev,
    ]);
    setNewName("");
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <ClassroomList classrooms={classrooms.slice(0, 4)} onCreate={() => setOpen(true)} />
      {loading ? (
        <LoadingSpinner label="Loading classrooms" />
      ) : (
        <DataTable
          data={classrooms}
          columns={columns}
          loading={loading}
          emptyState="No classrooms yet"
        />
      )}

      <BaseModal
        title="Create classroom"
        description="Assign grade, subject and invite learners."
        open={open}
        onOpenChange={setOpen}
      >
        <div className="space-y-4">
          <Input
            placeholder="e.g. Physics Lab 3B"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button className="w-full rounded-2xl" onClick={handleCreate}>
            Save classroom
          </Button>
        </div>
      </BaseModal>
    </div>
  );
}
