"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/http/client";
import { useRouter } from "next/navigation";
import { ErrorAlert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { useAuth } from "@/lib/guard/useAuth";

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

function AssignmentsPage() {
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { roles } = useAuth();
  const isStudent = roles.includes("STUDENT");

  useEffect(() => {
    fetchWithAuth<AssignmentRow[]>("GET", "/assignments/my")
      .then((data) => setItems(data ?? []))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Nelze načíst assignmenty";
        setError(message);
      });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Moje zadání</h1>
      {error && <ErrorAlert title="Chyba" description={error} />}
      <div className="grid gap-3">
        {items.map((a) => (
          <Card key={a.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">Assignment</p>
              <p className="text-sm text-slate-600">Open: {new Date(a.openAt).toLocaleString()}</p>
              <p className="text-sm text-slate-600">Close: {new Date(a.closeAt).toLocaleString()}</p>
            </div>
            <Button
              onClick={() => router.push(`/app/assignments/${a.id}`)}
              disabled={!isStudent}
              title={isStudent ? "" : "Pouze student může odevzdat assignment"}
            >
              Otevřít test
            </Button>
          </Card>
        ))}
        {!items.length && (
          <Card className="p-4 text-sm text-slate-600">
            {isStudent
              ? "Nemáš žádná aktivní zadání."
              : "Žádná zadání k zobrazení."}
          </Card>
        )}
      </div>
    </div>
  );
}

export default withGuard({
  requirePerms: [
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
    PermissionKey.VIEW_CLASS_ASSIGNMENTS,
    PermissionKey.VIEW_ORG_ASSIGNMENTS,
  ],
  requireSchoolWorkspace: true,
})(AssignmentsPage);
