"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Eye, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { fetchWithAuth } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";
import { usePermissions } from "@/hooks/use-permissions";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { PermissionKey, type OrganizationRole } from "@/types";
import { formatAllowedGrades } from "@/lib/grades";
import {
  AssignToClassModal,
  type TestTopicAssignment,
} from "@/components/tests/AssignToClassModal";

type ReadOnlyQuestion = {
  id: string;
  text?: string | null;
  type: string;
  score?: number | null;
  correctAnswer?: string | null;
  correctAnswers?: string[];
  options?: Array<{ id: string; text: string }>;
};

type ReadOnlyTest = {
  id: string;
  title: string;
  description?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  allowedGrades: string[];
  subject?: { id: string; name: string } | null;
  creator?: { user?: { id?: string; name?: string | null } | null } | null;
  questions?: ReadOnlyQuestion[];
  assignments?: TestTopicAssignment[];
};

const STAFF_ROLES: OrganizationRole[] = ["OWNER", "DIRECTOR", "TEACHER"];

function answerLabel(question: ReadOnlyQuestion): string | null {
  if (question.correctAnswers?.length) return question.correctAnswers.join(", ");
  return question.correctAnswer?.trim() || null;
}

function ReadOnlyTestPage(): React.JSX.Element {
  const { testId } = useParams<{ testId: string }>();
  const { can } = usePermissions();
  const { selectedYearId } = useAcademicYears();
  const [test, setTest] = useState<ReadOnlyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWithAuth<ReadOnlyTest>("GET", `/tests/${testId}/view`)
      .then((data) => {
        if (!cancelled) setTest(data ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTest(null);
          setError(
            err instanceof Error
              ? err.message
              : "Test se nepodařilo načíst.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  if (loading) return <LoadingSpinner label="Načítám test" />;

  if (error || !test) {
    return (
      <div className="space-y-4">
        <ErrorAlert
          title="Test nelze otevřít"
          description={error ?? "Test nebyl nalezen."}
        />
        <Button variant="outline" asChild>
          <Link href="/app/tests">Zpět na testy</Link>
        </Button>
      </div>
    );
  }

  const canAssign =
    test.status === "PUBLISHED" && can(PermissionKey.ASSIGN_TESTS);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/app/tests"
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            ← Zpět na testy
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Eye className="h-5 w-5 text-slate-500" />
            <h1 className="text-2xl font-semibold text-slate-900">
              {test.title}
            </h1>
            <Badge variant="neutral">Pouze pro čtení</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {test.subject?.name ?? "Bez předmětu"}
            {test.creator?.user?.name ? ` · autor: ${test.creator.user.name}` : ""}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Ročníky: {formatAllowedGrades(test.allowedGrades)}
          </p>
        </div>

        {canAssign && (
          <Button onClick={() => setAssignOpen(true)}>
            <Users className="h-4 w-4" />
            Přiřadit své třídě
          </Button>
        )}
      </div>

      {test.description && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Popis</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {test.description}
          </p>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Otázky</h2>
        {test.questions?.length ? (
          test.questions.map((question, index) => {
            const correct = answerLabel(question);
            return (
              <Card key={question.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {index + 1}. · {question.type}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {question.text || "Otázka bez textu"}
                    </p>
                    {question.options?.length ? (
                      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
                        {question.options.map((option) => (
                          <li key={option.id}>{option.text}</li>
                        ))}
                      </ul>
                    ) : null}
                    {correct && (
                      <p className="mt-3 text-xs text-emerald-700">
                        Správná odpověď: {correct}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {question.score ?? 0} b.
                  </span>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-5 text-sm text-slate-500">
            Test nemá otázky k zobrazení.
          </Card>
        )}
      </section>

      <AssignToClassModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        testId={test.id}
        subjectId={test.subject?.id ?? null}
        allowedGrades={test.allowedGrades}
        yearId={selectedYearId}
        {...(test.assignments !== undefined
          ? { testAssignments: test.assignments }
          : {})}
      />
    </div>
  );
}

export default withGuard({
  requireRoles: STAFF_ROLES,
  requireSchoolWorkspace: true,
})(ReadOnlyTestPage);
