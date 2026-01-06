"use client";

import { useEffect, useState } from "react";
import { TestCard } from "@/components/cards/test-card";
import { DataTable, type Column } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BaseModal } from "@/components/modals/base-modal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TestSummary } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const columns: Column<TestSummary>[] = [
  { key: "title", label: "Test" },
  { key: "subject", label: "Subject" },
  {
    key: "avgScore",
    label: "Avg Score",
    render: (row) => `${row.avgScore}%`,
  },
  {
    key: "completionRate",
    label: "Completion",
    render: (row) => `${row.completionRate}%`,
  },
  { key: "submissions", label: "Submissions" },
];

export default function TestsPage() {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "Mathematics" });

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const data = await fetchWithAuth<TestSummary[]>("GET", "/tests");
        setTests(data ?? []);
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, []);

  const handleCreate = () => {
    if (!form.title.trim()) return;
    setTests((prev) => [
      {
        id: crypto.randomUUID(),
        title: form.title,
        subject: form.subject,
        avgScore: 0,
        completionRate: 0,
        submissions: 0,
        description: null,
        status: "DRAFT",
        version: 1,
      },
      ...prev,
    ]);
    setForm({ title: "", subject: "Mathematics" });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Assessments</h2>
          <p className="text-sm text-slate-500">
            Monitor performance, drafts and published tests.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>New test</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tests.slice(0, 3).map((test) => (
          <TestCard key={test.id} test={test} />
        ))}
      </div>
      {loading ? (
        <LoadingSpinner label="Loading tests" />
      ) : (
        <DataTable data={tests} columns={columns} loading={loading} />
      )}

      <BaseModal
        title="Create test"
        description="Draft a quick formative assessment."
        open={open}
        onOpenChange={setOpen}
      >
        <div className="space-y-4">
          <Input
            placeholder="Test title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <Select
            value={form.subject}
            onValueChange={(value) => setForm((prev) => ({ ...prev, subject: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mathematics">Mathematics</SelectItem>
              <SelectItem value="Science">Science</SelectItem>
              <SelectItem value="Languages">Languages</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={handleCreate}>
            Save draft
          </Button>
        </div>
      </BaseModal>
    </div>
  );
}
