"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { ErrorAlert, InfoAlert, SuccessAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";

type Assignment = {
  id: string;
  testId: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
  attemptNo?: number;
};

type TestQuestion = {
  id: string;
  text: string;
  type: "TRUE_FALSE" | "FILL_IN_THE_BLANK" | "MULTIPLE_CHOICE";
  options?: Array<{ id: string; text: string }>;
  correctAnswer?: string | null;
  correctAnswers?: string[] | null;
};

type TestDetail = {
  id: string;
  title: string;
  description?: string | null;
  questions: TestQuestion[];
};

type Submission = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  score: number | null;
  earnedPoints?: number | null;
  maxPoints?: number | null;
  percentage?: number | null;
  submittedAt: string | null;
};

type ResponsePayload = {
  questionId: string;
  givenText: string | string[];
};

function AssignmentSubmissionPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [test, setTest] = useState<TestDetail | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const load = async () => {
      try {
        const assignmentData = await fetchWithAuth<Assignment>("GET", `/assignments/${assignmentId}`);
        if (!active) return;
        if (!assignmentData) {
          setError("Zadání nebylo nalezeno.");
          return;
        }
        setAssignment(assignmentData);
        if (!assignmentData.testId) {
          setError("Zadání nemá přiřazený test.");
          return;
        }
        const testData = await fetchWithAuth<TestDetail>("GET", `/tests/${assignmentData.testId}`);
        if (!active) return;
        if (!testData) {
          setError("Test nebyl nalezen.");
          return;
        }
        setTest(testData);
      } catch {
        if (!active) return;
        setError("Nepodařilo se načíst zadání.");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (assignmentId) load();
    return () => {
      active = false;
    };
  }, [assignmentId]);

  const isReadOnly = submission?.status === "APPROVED" || submission?.status === "REJECTED";

  const isMultiChoice = (q: TestQuestion) =>
    q.type === "MULTIPLE_CHOICE" && (q.correctAnswers?.length ?? 0) > 0;

  const updateAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const buildResponses = (): ResponsePayload[] => {
    if (!test) return [];
    const responses: ResponsePayload[] = [];
    test.questions.forEach((q) => {
      const value = answers[q.id];
      if (value === undefined) return;
      if (Array.isArray(value) && value.length === 0) return;
      if (!Array.isArray(value) && String(value).trim().length === 0) return;
      responses.push({ questionId: q.id, givenText: value });
    });
    return responses;
  };

  const startSubmission = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const created = await fetchWithAuth<Submission>("POST", "/submissions", {
        body: { assignmentId },
      });
      setSubmission(created);
      setSuccess("Submission byla vytvořena. Můžeš vyplnit odpovědi.");
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 403) {
          setError("Nemáš oprávnění k odevzdání tohoto testu.");
          return;
        }
        if (err.status === 400) {
          setError(err.message || "Neplatné zadání.");
          return;
        }
      }
      setError("Nepodařilo se založit submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const saveResponses = async () => {
    if (!submission?.id) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const responses = buildResponses();
      await fetchWithAuth<{ success: boolean }>(
        "PATCH",
        `/submissions/${submission.id}/responses`,
        { body: { responses } },
      );
      setSuccess("Odpovědi byly uloženy.");
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 403) {
          setError("Nemáš oprávnění ukládat odpovědi.");
          return;
        }
        if (err.status === 400) {
          setError(err.message || "Odpovědi nejsou validní.");
          return;
        }
      }
      setError("Nepodařilo se uložit odpovědi.");
    } finally {
      setSaving(false);
    }
  };

  const finishSubmission = async () => {
    if (!submission?.id) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const finished = await fetchWithAuth<Submission>(
        "POST",
        `/submissions/${submission.id}/finish`,
      );
      setSubmission(finished);
      if (finished.status === "REJECTED") {
        setSuccess("Submission byla zamítnuta (nelze vyhodnotit).");
      } else {
        setSuccess("Submission byla odevzdána.");
      }
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 403) {
          setError("Nemáš oprávnění dokončit submission.");
          return;
        }
        if (err.status === 400) {
          setError(err.message || "Nelze dokončit submission.");
          return;
        }
      }
      setError("Odevzdání selhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  const scoreLabel = useMemo(() => {
    if (!submission) return null;
    if (submission.status === "REJECTED") return "Nelze vyhodnotit";
    if (
      submission.earnedPoints != null &&
      submission.maxPoints != null &&
      submission.maxPoints > 0
    ) {
      const percentage =
        submission.percentage ??
        (submission.earnedPoints / submission.maxPoints) * 100;
      return `${submission.earnedPoints} / ${submission.maxPoints} (${Math.round(percentage)} %)`;
    }
    if (submission.score === null) return "Skóre není k dispozici";
    return `${Math.round(submission.score * 100)} %`;
  }, [submission]);

  if (loading) {
    return <LoadingSpinner label="Načítám zadání" />;
  }

  if (!assignment || !test) {
    return <ErrorAlert title="Chyba" description="Zadání se nepodařilo načíst" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{test.title}</h1>
        {test.description && <p className="text-sm text-slate-600">{test.description}</p>}
        <p className="text-sm text-slate-500">
          Otevřeno: {new Date(assignment.openAt).toLocaleString()} | Uzavřeno: {new Date(assignment.closeAt).toLocaleString()}
        </p>
      </div>

      {error && <ErrorAlert title="Chyba" description={error} />}
      {success && <SuccessAlert title="Hotovo" description={success} />}

      {!submission && (
        <Button onClick={startSubmission} disabled={submitting}>
          {submitting ? "Zakládám submission..." : "Začít pokus"}
        </Button>
      )}

      {submission && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-slate-500">Stav</p>
              <p className="font-semibold">{submission.status}</p>
            </div>
            {scoreLabel && (
              <div className="text-right">
                <p className="text-sm text-slate-500">Score</p>
                <p className="font-semibold">{scoreLabel}</p>
              </div>
            )}
          </div>
          {submission.submittedAt && (
            <p className="text-sm text-slate-500">Odevzdáno: {new Date(submission.submittedAt).toLocaleString()}</p>
          )}
        </Card>
      )}

      {submission && !isReadOnly && test && Array.isArray(test.questions) && (
        <div className="space-y-4">
          {test.questions.map((q) => (
            <Card key={q.id} className="space-y-3 p-4">
              <p className="font-medium">{q.text}</p>
              {q.type === "TRUE_FALSE" && (
                <div className="flex gap-4">
                  {["true", "false"].map((value) => (
                    <label key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={q.id}
                        value={value}
                        checked={answers[q.id] === value}
                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                      />
                      <span>{value === "true" ? "Ano" : "Ne"}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === "FILL_IN_THE_BLANK" && (
                <input
                  className="w-full rounded border px-3 py-2"
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                  placeholder="Napiš odpověď"
                />
              )}
              {q.type === "MULTIPLE_CHOICE" && !isMultiChoice(q) && (
                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.text}
                        checked={answers[q.id] === opt.text}
                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                      />
                      <span>{opt.text}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === "MULTIPLE_CHOICE" && isMultiChoice(q) && (
                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => {
                    const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                    const checked = current.includes(opt.text);
                    return (
                      <label key={opt.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? current.filter((item) => item !== opt.text)
                              : [...current, opt.text];
                            updateAnswer(q.id, next);
                          }}
                        />
                        <span>{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}

          <div className="flex flex-wrap gap-3">
            <Button onClick={saveResponses} disabled={saving} variant="outline">
              {saving ? "Ukládám..." : "Uložit odpovědi"}
            </Button>
            <Button onClick={finishSubmission} disabled={submitting}>
              {submitting ? "Odevzdávám..." : "Dokončit"}
            </Button>
          </div>
        </div>
      )}

      {submission && isReadOnly && (
        <InfoAlert
          title="Submission je uzavřená"
          description="Tento pokus je read-only."
        />
      )}
    </div>
  );
}

const studentOnly: OrganizationRole[] = ["STUDENT"];

export default withGuard({
  requireRoles: studentOnly,
  requireSchoolWorkspace: true,
})(AssignmentSubmissionPage);
