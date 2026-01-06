"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { fetchWithAuth } from "@/lib/http/client";

type TestQuestion = {
  id: string;
  text: string;
  type: string;
  options?: { id: string; text: string }[];
};

type TestDetail = {
  id: string;
  title: string;
  description?: string | null;
  questions: TestQuestion[];
};

export default function StudentTestPage() {
  const { testId } = useParams<{ testId: string }>();
  const search = useSearchParams();
  const assignmentId = search.get("assignmentId") ?? "";
  const [test, setTest] = useState<TestDetail | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth<TestDetail>("GET", `/tests/${testId}`)
      .then((data) => setTest(data))
      .catch((e: any) => setError(e?.message ?? "Nepodařilo se načíst test"));
  }, [testId]);

  const startSubmission = async () => {
    setError(null);
    try {
      const created = await fetchWithAuth<{ id: string }>("POST", "/submissions", {
        body: { assignmentId },
      });
      setSubmissionId(created.id);
    } catch (e: any) {
      setError(e?.message ?? "Nelze založit submission");
    }
  };

  const finish = async () => {
    if (!submissionId) return;
    try {
      const resp = await fetchWithAuth<{ score: number }>(
        "POST",
        `/submissions/${submissionId}/finish`,
        {
          body: {
            responses: Object.entries(answers).map(([questionId, givenText]) => ({
              questionId,
              givenText,
            })),
          },
        },
      );
      setScore(resp.score ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Odevzdání selhalo");
    }
  };

  if (!assignmentId) {
    return <Alert title="Chybí assignmentId" description="Předáte ho přes ?assignmentId=" variant="warning" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{test?.title ?? "Test"}</h1>
          {test?.description && <p className="text-sm text-slate-600">{test.description}</p>}
        </div>
        {!submissionId && (
          <Button onClick={startSubmission} disabled={!assignmentId}>
            Začít pokus
          </Button>
        )}
      </div>

      {test?.questions.map((q) => (
        <Card key={q.id} className="space-y-2 p-4">
          <p className="font-medium">{q.text}</p>
          {(q.options ?? []).map((opt) => (
            <label key={opt.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={q.id}
                value={opt.text}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              />
              <span>{opt.text}</span>
            </label>
          ))}
        </Card>
      ))}

      {submissionId && (
        <Button onClick={finish} className="w-full">
          Odevzdat
        </Button>
      )}

      {score !== null && (
        <Alert
          title="Výsledek"
          description={`Score: ${Math.round(score * 100)} %`}
          variant="success"
        />
      )}
      {error && <Alert title="Chyba" description={error} variant="warning" />}
    </div>
  );
}
