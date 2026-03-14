"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorAlert, InfoAlert } from "@/components/ui/alert";
import { fetchWithAuth } from "@/lib/http/client";
import { useSubjects, subjectLabel } from "@/hooks/use-subjects";
import { withGuard } from "@/lib/guard/withGuard";
import { ALL_SCHOOL_GRADES, gradeLabel, type SchoolGradeValue } from "@/lib/grades";
import { PermissionKey } from "@/types";

function CreateTestPage(): React.JSX.Element {
  const router = useRouter();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [allowedGrades, setAllowedGrades] = useState<SchoolGradeValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      setError("Název testu musí mít alespoň 3 znaky.");
      return;
    }
    if (!subjectId) {
      setError("Vyberte předmět.");
      return;
    }
    if (allowedGrades.length === 0) {
      setError("Vyberte alespoň jeden ročník, pro který je test určen.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const created = await fetchWithAuth<{ id: string }>("POST", "/tests", {
        body: {
          title: title.trim(),
          description: description.trim() || undefined,
          status: "DRAFT",
          subjectId,
          allowedGrades,
        },
      });
      const id = created && typeof created === "object" && "id" in created ? (created as { id: string }).id : null;
      if (id) {
        router.push(`/app/tests/${id}`);
      } else {
        router.push("/app/tests");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vytvoření testu se nezdařilo.");
    } finally {
      setLoading(false);
    }
  };

  const noSubjects = !subjectsLoading && subjects.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/app/tests" className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět na testy
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Vytvořit test</h1>
        <p className="text-sm text-slate-500">Zadej název a popis. Po vytvoření můžeš přidat otázky a přiřadit třídě.</p>
      </div>
      {noSubjects && (
        <InfoAlert
          title="Nejsou vytvořeny žádné předměty"
          description="Nejdříve vytvořte předmět v nastavení organizace. Test musí být přiřazen k předmětu."
        />
      )}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Název testu *</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="např. Písemka – Zlomky"
              minLength={3}
              maxLength={255}
              className="w-full"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Popis (nepovinné)</span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krátký popis testu"
              className="w-full"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Předmět *</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
              disabled={subjectsLoading || noSubjects}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">{subjectsLoading ? "Načítám předměty…" : "Vyberte předmět"}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.subject.id}>
                  {subjectLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Určeno pro ročníky *</legend>
            <p className="text-sm text-slate-500">Vyberte, pro které ročníky je test pedagogicky určen.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_SCHOOL_GRADES.map((grade) => {
                const checked = allowedGrades.includes(grade);
                return (
                  <label
                    key={grade}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                      checked ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
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
          {error && (
            <ErrorAlert title="Chyba" description={error} />
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading || noSubjects}>
              {loading ? "Vytvářím…" : "Vytvořit test"}
            </Button>
            <Link href="/app/tests">
              <Button type="button" variant="outline">Zrušit</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST],
})(CreateTestPage);
