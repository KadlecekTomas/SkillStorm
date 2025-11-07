"use client";

import { useEffect, useState } from "react";
import { ClassroomList } from "@/components/content/classroom-list";
import { BaseModal } from "@/components/modals/base-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/table";
import { Classroom } from "@/types";
import { apiClient } from "@/utils/api-client";
import { classroomSamples } from "@/utils/sample-data";

const columns: Column<Classroom>[] = [
  { key: "name", label: "Classroom" },
  { key: "grade", label: "Grade" },
  { key: "subject", label: "Subject" },
  { key: "students", label: "Students" },
  { key: "updatedAt", label: "Updated" },
];

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>(classroomSamples);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await apiClient.get<Classroom[]>("/classrooms");
        if (data?.length) setClassrooms(data);
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
        name: newName,
        grade: "Custom",
        students: 0,
        subject: "General",
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
      <DataTable
        data={classrooms}
        columns={columns}
        loading={loading}
        emptyState="No classrooms yet"
      />

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
          <Button className="w-full" onClick={handleCreate}>
            Save classroom
          </Button>
        </div>
      </BaseModal>
    </div>
  );
}
