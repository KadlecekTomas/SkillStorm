"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/http/client";
import { useRouter } from "next/navigation";
import { ErrorAlert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { useAuth } from "@/lib/guard/useAuth";
import { formatDate } from "@/lib/format-date";
import { useQuery } from "@/lib/query-client";
import { buildListQueryKey } from "@/lib/list-query";

type AssignmentRow = {
  id: string;
  testId: string;
  classSectionId: string | null;
  organizationId: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
  attemptNo: number;
  attemptsUsed: number;
  submissionId: string | null;
};

function assignmentTargetHref(assignment: AssignmentRow): string {
  if (assignment.submissionId || assignment.attemptsUsed > 0) {
    return `/app/results/${assignment.submissionId ?? assignment.id}`;
  }
  return `/app/assignments/${assignment.id}`;
}

function AssignmentsPage() {
  const router = useRouter();
  const { roles } = useAuth();
  const isStudent = roles.includes("STUDENT");
  const assignmentsQuery = useQuery<AssignmentRow[]>({
    queryKey: buildListQueryKey("assignments-my", {}),
    staleTime: 10_000,
    queryFn: async () => (await fetchWithAuth<AssignmentRow[]>("GET", "/assignments/my")) ?? [],
  });
  const items = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const error = assignmentsQuery.error instanceof Error ? assignmentsQuery.error.message : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Moje zadání</h1>
      {error && <ErrorAlert title="Chyba" description={error} />}
      <div className="grid gap-3">
        {items.map((a) => (
          <Card key={a.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">Assignment</p>
              <p className="text-sm text-slate-600">Open: {formatDate(a.openAt)}</p>
              <p className="text-sm text-slate-600">Close: {formatDate(a.closeAt)}</p>
            </div>
            <Button
              onClick={() => router.push(assignmentTargetHref(a))}
              disabled={!isStudent}
              title={isStudent ? "" : "Pouze student může odevzdat assignment"}
            >
              {a.submissionId || a.attemptsUsed > 0 ? "Zobrazit výsledek" : "Otevřít test"}
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
