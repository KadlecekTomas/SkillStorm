"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/http/client";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";

type AssignmentRow = {
  id: string;
  testId: string;
  classSectionId: string | null;
  organizationId: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
  attemptNo: number;
};

export default function AssignmentsPage() {
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchWithAuth<AssignmentRow[]>("GET", "/assignments/my")
      .then((data) => setItems(data ?? []))
      .catch((e: any) => setError(e?.message ?? "Nelze načíst assignmenty"));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Moje zadání</h1>
      {error && <Alert title="Chyba" description={error} variant="warning" />}
      <div className="grid gap-3">
        {items.map((a) => (
          <Card key={a.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">Assignment</p>
              <p className="text-sm text-slate-600">Open: {new Date(a.openAt).toLocaleString()}</p>
              <p className="text-sm text-slate-600">Close: {new Date(a.closeAt).toLocaleString()}</p>
            </div>
            <Button onClick={() => router.push(`/dashboard/tests/${a.testId}/submission?assignmentId=${a.id}`)}>
              Otevřít test
            </Button>
          </Card>
        ))}
        {!items.length && <Card className="p-4 text-sm text-slate-600">Žádná aktivní zadání.</Card>}
      </div>
    </div>
  );
}
