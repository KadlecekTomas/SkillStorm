"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { Card } from "@/components/ui/card";
import { ErrorAlert, InfoAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { withGuard } from "@/lib/guard/withGuard";
import { submissionStatusLabel } from "@/lib/labels";
import type { OrganizationRole } from "@/types";

type SubmissionResult = {
  id: string;
  assignmentId: string | null;
  testId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  score: number | null;
  earnedPoints: number | null;
  maxPoints: number | null;
  percentage: number | null;
  submittedAt: string | null;
  attemptNo: number;
  responses: Array<{
    questionId: string;
    givenText: string;
    isCorrect: boolean | null;
  }>;
};

type TestDetail = {
  title: string;
};

function SubmissionResultPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [testTitle, setTestTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWithAuth<SubmissionResult>("GET", `/submissions/${submissionId}`)
      .then(async (data) => {
        if (cancelled) return;
        setSubmission(data ?? null);
        if (data?.testId) {
          const testData = await fetchWithAuth<TestDetail>("GET", `/tests/${data.testId}`).catch(() => null);
          if (!cancelled) setTestTitle(testData?.title ?? null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Výsledek se nepodařilo načíst. Zkus to prosím znovu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  const scoreLabel = useMemo(() => {
    if (!submission) return null;
    if (submission.earnedPoints != null && submission.maxPoints != null && submission.maxPoints > 0) {
      const percentage =
        submission.percentage ??
        Math.round((submission.earnedPoints / submission.maxPoints) * 10000) / 100;
      return `${submission.earnedPoints} / ${submission.maxPoints} (${Math.round(percentage)} %)`;
    }
    if (submission.score == null) return "Skóre zatím není k dispozici";
    return `${Math.round(submission.score * 100)} %`;
  }, [submission]);

  if (loading) {
    return <LoadingSpinner label="Načítám výsledek" />;
  }

  if (error || !submission) {
    return (
      <div className="space-y-4">
        <ErrorAlert title="Chyba" description={error ?? "Výsledek nebyl nalezen."} />
        <Link href="/app/assignments">
          <Button variant="outline">Zpět na zadání</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/assignments" className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět na zadání
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Výsledek pokusu</h1>
        {testTitle && <p className="mt-1 text-lg font-medium text-slate-800">{testTitle}</p>}
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Stav</p>
            <p className="font-semibold">{submissionStatusLabel(submission.status)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Skóre</p>
            <p className="font-semibold">{scoreLabel}</p>
          </div>
        </div>
        <p className="text-sm text-slate-500">Pokus č. {submission.attemptNo}</p>
        <p className="text-sm text-slate-500">
          Odevzdáno: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString("cs-CZ") : "zatím ne"}
        </p>
      </Card>

      {submission.status === "PENDING" && (
        <InfoAlert
          title="Pokus čeká na uzavření"
          description="Tento pokus už existuje, proto se nevracíš zpět na start. Po vyhodnocení zde uvidíš finální výsledek."
        />
      )}

      <div className="space-y-3">
        {submission.responses.map((response, index) => (
          <Card key={`${response.questionId}-${index}`} className="space-y-2 p-4">
            <p className="text-sm font-medium text-slate-900">Odpověď {index + 1}</p>
            <p className="text-sm text-slate-600 break-words">{response.givenText || "—"}</p>
            <p className="text-sm text-slate-500">
              Vyhodnocení:{" "}
              {response.isCorrect === true ? "správně" : response.isCorrect === false ? "špatně" : "čeká na vyhodnocení"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

const studentOnly: OrganizationRole[] = ["STUDENT"];

export default withGuard({
  requireRoles: studentOnly,
  requireSchoolWorkspace: true,
})(SubmissionResultPage);
