"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorAlert, InfoAlert, SuccessAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { fetchWithAuth } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";
import { useSubjects, subjectLabel } from "@/hooks/use-subjects";
import { ALL_SCHOOL_GRADES, gradeLabel, type SchoolGradeValue } from "@/lib/grades";
import { PermissionKey, type OrgSubjectOption } from "@/types";
import { EditQuestionDialog } from "@/components/tests/EditQuestionDialog";

type QuestionOption = { id: string; text: string };

type TestQuestion = {
  id: string;
  type: string;
  text?: string;
  correctAnswer?: string | null;
  correctAnswers?: string[];
  score?: number;
  order?: number | null;
  options?: QuestionOption[];
};

type TestEditMode = "FULL" | "LIMITED" | "NONE";

type TestDetail = {
  id: string;
  title: string;
  description?: string | null;
  subject?: { id: string; name: string; catalogSubject?: { code: string; name: string } | null } | null;
  allowedGrades: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  editMode: TestEditMode;
  submissionCount: number;
  questions?: TestQuestion[];
};

function EditTestPage(): React.JSX.Element {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params?.testId ?? "";
  const { subjects } = useSubjects();

  const [test, setTest] = useState<TestDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [allowedGrades, setAllowedGrades] = useState<SchoolGradeValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<TestQuestion | null>(null);
  const [questionActionLoadingId, setQuestionActionLoadingId] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [addQuestionLoading, setAddQuestionLoading] = useState(false);

  const fetchTest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth<TestDetail>("GET", `/tests/${testId}`);
      setTest(data ?? null);
      setTitle(data?.title ?? "");
      setDescription(data?.description ?? "");
      setSubjectId(data?.subject?.id ?? "");
      setAllowedGrades(
        (data?.allowedGrades ?? []).filter((grade): grade is SchoolGradeValue =>
          ALL_SCHOOL_GRADES.includes(grade as SchoolGradeValue),
        ),
      );
    } catch (e) {
      setTest(null);
      setError(e instanceof Error ? e.message : "Nepodařilo se načíst test.");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    void fetchTest();
  }, [fetchTest]);

  const subjectOptions = useMemo<OrgSubjectOption[]>(() => {
    if (!test?.subject) return subjects;
    const exists = subjects.some((item) => item.subject.id === test.subject?.id);
    if (exists) return subjects;
    return [
      {
        id: `legacy-${test.subject.id}`,
        organizationId: "",
        isEnabled: false,
        isCustom: false,
        subject: {
          id: test.subject.id,
          name: test.subject.name,
          gradeFrom: 1,
          gradeTo: 9,
        },
      },
      ...subjects,
    ];
  }, [subjects, test?.subject]);

  const editMode = test?.editMode ?? "NONE";
  const structureLocked = editMode === "LIMITED";

  const handleSave = async () => {
    if (!test) return;
    if (!title.trim() || title.trim().length < 3) {
      setError("Název testu musí mít alespoň 3 znaky.");
      return;
    }
    if (!structureLocked) {
      if (!subjectId) {
        setError("Vyberte předmět.");
        return;
      }
      if (allowedGrades.length === 0) {
        setError("Vyberte alespoň jeden ročník.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchWithAuth("PATCH", `/tests/${testId}`, {
        body: {
          title: title.trim(),
          description: description.trim() || null,
          ...(!structureLocked ? { subjectId, allowedGrades } : {}),
        },
      });
      await fetchTest();
      setSuccess("Test byl upraven.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uložení změn selhalo.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = async () => {
    setAddQuestionLoading(true);
    setQuestionError(null);
    try {
      await fetchWithAuth("POST", `/tests/${testId}/questions`, {
        body: { text: "Nová otázka", type: "TRUE_FALSE", order: test?.questions?.length ?? 0 },
      });
      await fetchTest();
      setSuccess("Otázka byla přidána.");
    } catch (e) {
      setQuestionError(e instanceof Error ? e.message : "Nepodařilo se přidat otázku.");
    } finally {
      setAddQuestionLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Opravdu chcete smazat tuto otázku?")) {
      return;
    }
    setQuestionActionLoadingId(questionId);
    setQuestionError(null);
    try {
      await fetchWithAuth("DELETE", `/tests/${testId}/questions/${questionId}`);
      await fetchTest();
      setSuccess("Otázka byla smazána.");
    } catch (e) {
      setQuestionError(e instanceof Error ? e.message : "Nepodařilo se smazat otázku.");
    } finally {
      setQuestionActionLoadingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Načítám editor testu" />;
  }

  if (!test) {
    return (
      <div className="space-y-4">
        <ErrorAlert title="Chyba" description={error ?? "Test nebyl nalezen."} />
        <Link href="/app/tests">
          <Button variant="outline">Zpět na testy</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link href={`/app/tests/${testId}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět na detail testu
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Upravit test</h1>
      </div>

      {structureLocked && (
        <InfoAlert
          title="Tento test již má odevzdané pokusy. Úpravy otázek jsou uzamčeny."
          description="Můžete upravit pouze název a popis testu."
        />
      )}

      {error && <ErrorAlert title="Chyba" description={error} />}
      {success && <SuccessAlert title="Hotovo" description={success} />}

      <Card className="space-y-4 p-6">
        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Název testu</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Popis</span>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Předmět</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={structureLocked}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Vyberte předmět</option>
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.subject.id}>
                  {subjectLabel(subject)}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Cílové ročníky</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ALL_SCHOOL_GRADES.map((grade) => {
                const checked = allowedGrades.includes(grade);
                return (
                  <label
                    key={grade}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                      checked ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-700"
                    } ${structureLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={structureLocked}
                      onChange={(e) =>
                        setAllowedGrades((prev) =>
                          e.target.checked
                            ? [...prev, grade]
                            : prev.filter((item) => item !== grade),
                        )
                      }
                    />
                    <span>{gradeLabel(grade)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Ukládám…" : "Uložit změny"}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/app/tests/${testId}`)}>
            Zpět na detail
          </Button>
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Otázky</h2>
          {!structureLocked && (
            <Button variant="outline" size="sm" onClick={() => void handleAddQuestion()} disabled={addQuestionLoading}>
              {addQuestionLoading ? "Přidávám…" : "+ Přidat otázku"}
            </Button>
          )}
        </div>

        {questionError && <ErrorAlert title="Chyba" description={questionError} className="text-sm" />}

        {test.questions?.length ? (
          <ul className="space-y-2">
            {test.questions.map((question, index) => (
              <li key={question.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {index + 1} · {question.type}
                    </p>
                    <p className="text-sm font-medium text-slate-800">{question.text ?? "(bez textu)"}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{question.score ?? 0} bodů</span>
                      {question.correctAnswer && <span>Správná odpověď: {question.correctAnswer}</span>}
                      {question.correctAnswers?.length ? <span>Správné odpovědi: {question.correctAnswers.join(", ")}</span> : null}
                    </div>
                  </div>
                  {!structureLocked && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingQuestion(question)}>
                        Upravit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteQuestion(question.id)}
                        disabled={questionActionLoadingId === question.id}
                      >
                        {questionActionLoadingId === question.id ? "Mažu…" : "Smazat"}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="p-4 text-sm text-slate-600">Test zatím neobsahuje žádné otázky.</Card>
        )}
      </section>

      <EditQuestionDialog
        open={editingQuestion !== null}
        onOpenChange={(open) => {
          if (!open) setEditingQuestion(null);
        }}
        testId={testId}
        question={editingQuestion}
        onSaved={async () => {
          await fetchTest();
          setSuccess("Otázka byla upravena.");
        }}
      />
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.EDIT_TEST],
})(EditTestPage);
