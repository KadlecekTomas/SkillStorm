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
  testTitle: string;
  subjectName: string | null;
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
  if (assignment.submissionId) {
    return `/app/results/${assignment.submissionId}`;
  }
  return `/app/assignments/${assignment.id}`;
}

function assignmentActionLabel(assignment: AssignmentRow): string {
  if (assignment.submissionId) return "Zobrazit výsledek";
  if (assignment.attemptsUsed > 0) return "Pokračovat";
  return "Otevřít test";
}

function AssignmentsPage() {
  const router = useRouter();
  const { activeRole, roles } = useAuth();
  const effectiveRole = activeRole ?? roles[0] ?? null;
  const isStudent = effectiveRole === "STUDENT";
  const assignmentsQuery = useQuery<AssignmentRow[]>({
    queryKey: buildListQueryKey("assignments-my", {}),
    staleTime: 10_000,
    queryFn: async () => (await fetchWithAuth<AssignmentRow[]>("GET", "/assignments/my")) ?? [],
  });
  const items = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const error = assignmentsQuery.error instanceof Error ? assignmentsQuery.error.message : null;

  const openAssignment = (assignment: AssignmentRow): void => {
    if (isStudent) {
      router.push(assignmentTargetHref(assignment));
      return;
    }
    router.push(`/app/tests/${assignment.testId}/results`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {isStudent ? "Moje zadání" : "Zadání a výsledky"}
        </h1>
        {!isStudent && (
          <p className="mt-1 text-sm text-slate-500">
            Otevřete výsledky testu a zkontrolujte práci žáků.
          </p>
        )}
      </div>
      {error && <ErrorAlert title="Chyba" description={error} />}
      <div className="grid gap-3">
        {items.map((a) => (
          <Card key={a.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">
                {a.testTitle || "Zadání"}
              </p>
              <p className="text-sm text-ink-muted">
                {a.subjectName ? `${a.subjectName} · ` : ""}
                Otevřeno od {formatDate(a.openAt)}
              </p>
              <p className="text-sm text-ink-muted">
                Uzavírá se {formatDate(a.closeAt)}
              </p>
            </div>
            <Button onClick={() => openAssignment(a)}>
              {isStudent ? assignmentActionLabel(a) : "Zobrazit výsledky"}
            </Button>
          </Card>
        ))}
        {!items.length && (
          <Card className="p-4 text-sm text-slate-600">
            {isStudent
              ? "Nemáš žádná aktivní zadání."
              : "Ve vašem rozsahu zatím nejsou žádná zadání."}
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
