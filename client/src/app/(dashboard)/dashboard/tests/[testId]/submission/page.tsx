"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { httpClient, HttpError } from "@/lib/http/client";
import { TestDetail, type TestQuestion } from "@/components/tests/test-detail";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { audit } from "@/lib/audit/audit.client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";

type SubmissionPayload = {
  submission: {
    id: string;
  };
};

type SubmissionSummary = {
  summary: {
    score: number;
    correct: number;
    total: number;
  };
};

type TestResponse = {
  test: {
    id: string;
    title: string;
    description: string;
    questions: TestQuestion[];
  };
};

function TestSubmissionPage() {
  const params = useParams<{ testId: string }>();
  const [test, setTest] = useState<TestResponse["test"] | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SubmissionSummary["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    httpClient
      .get<TestResponse>(`/tests/${params.testId}`)
      .then((data) => {
        if (!active) return;
        setTest(data.test);
      })
      .catch(() => setError("Nepodařilo se načíst test."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.testId]);

  const startAttempt = async () => {
    setError(null);
    try {
      const response = await httpClient.post<SubmissionPayload, { testId: string }>(
        "/submissions",
        { testId: String(params.testId) },
      );
      setSubmissionId(response.submission.id);
      setSummary(null);
      audit({ action: "SUBMISSION_START", entityId: response.submission.id, meta: { testId: params.testId } });
    } catch (err) {
      if (err instanceof HttpError && err.status === 403) {
        setError("Limit pokusů byl vyčerpán.");
        return;
      }
      setError("Nepodařilo se založit pokus.");
    }
  };

  const handleSubmit = async (answers: Record<string, string>) => {
    if (!submissionId) return;
    setSubmitting(true);
    setError(null);
    try {
      await httpClient.patch(`/submissions/${submissionId}`, { answers });
      const result = await httpClient.post<SubmissionSummary>(`/submissions/${submissionId}/finish`);
      setSubmissionId(null);
      setSummary(result.summary);
      audit({
        action: "SUBMISSION_FINISH",
        entityId: submissionId,
        meta: { testId: params.testId, score: result.summary.score },
      });
    } catch {
      setError("Nepodařilo se odeslat odpovědi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Načítám zadání" />;
  }

  if (!test) {
    return (
      <Alert title="Chyba" description="Test se nepodařilo načíst" variant="warning" />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          data-testid="submission-ready"
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        />
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Submission</p>
          <h1 className="text-2xl font-semibold text-slate-900">{test.title}</h1>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={startAttempt}
          disabled={Boolean(submissionId)}
        >
          {submissionId ? "Probíhá pokus" : "Start attempt"}
        </Button>
      </div>

      {error && <Alert title="Omezení" description={error} variant="warning" />}

      {submissionId && (
        <TestDetail
          title="Odpovědi"
          questions={test.questions}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}

      {summary && (
        <Alert
          title="Výsledek pokusu"
          description={`Score ${summary.score}% (${summary.correct}/${summary.total})`}
          variant="success"
        />
      )}
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.VIEW_RESULTS],
})(TestSubmissionPage);
