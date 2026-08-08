"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PermissionKey } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchWithAuth } from "@/lib/http/client";
import { showToastOnce } from "@/utils/toast";

type StudentRecord = {
  id: string;
  studentNumber: string | null;
  externalId: string | null;
  membership: {
    user: { id: string; name: string | null; email: string | null };
  };
  enrollments: Array<{
    classSectionId: string;
    academicYear: { isCurrent: boolean };
    classSection: { id: string; label: string | null; grade: string; section: string };
  }>;
};

type ClassOption = {
  id: string;
  label?: string | null;
  grade: string;
  section: string;
  yearId?: string;
};

type FormState = {
  name: string;
  email: string;
  classSectionId: string;
  studentNumber: string;
  externalId: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  classSectionId: "",
  studentNumber: "",
  externalId: "",
};

function unwrap<T>(value: T | { data?: T }): T | null {
  if (value && typeof value === "object" && "data" in value) {
    return (value as { data?: T }).data ?? null;
  }
  return value as T;
}

function classLabel(item: ClassOption): string {
  return item.label?.trim() || `${item.grade.replace("GRADE_", "")}.${item.section}`;
}

export function StudentAdminEditor(): React.JSX.Element | null {
  const params = useParams();
  const studentId = typeof params.studentId === "string" ? params.studentId : null;
  const { can } = usePermissions();
  const canManage = can(PermissionKey.MANAGE_STUDENTS);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const currentEnrollment = useMemo(
    () => student?.enrollments.find((item) => item.academicYear.isCurrent) ?? null,
    [student],
  );

  useEffect(() => {
    if (!canManage || !studentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchWithAuth<StudentRecord | { data?: StudentRecord }>("GET", `/students/${studentId}`),
      fetchWithAuth<ClassOption[] | { data?: ClassOption[] }>("GET", "/class-sections"),
    ])
      .then(([studentResponse, classResponse]) => {
        if (cancelled) return;
        const nextStudent = unwrap(studentResponse);
        const nextClasses = unwrap(classResponse) ?? [];
        if (!nextStudent) throw new Error("Žáka se nepodařilo načíst.");
        const active = nextStudent.enrollments.find((item) => item.academicYear.isCurrent) ?? null;
        setStudent(nextStudent);
        setClasses(Array.isArray(nextClasses) ? nextClasses : []);
        setForm({
          name: nextStudent.membership.user.name ?? "",
          email: nextStudent.membership.user.email ?? "",
          classSectionId: active?.classSectionId ?? "",
          studentNumber: nextStudent.studentNumber ?? "",
          externalId: nextStudent.externalId ?? "",
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Správu žáka se nepodařilo načíst.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, studentId]);

  if (!canManage || !studentId) return null;

  const save = async () => {
    if (form.name.trim().length < 2) {
      setError("Jméno musí mít alespoň 2 znaky.");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      setError("Zadejte platný e-mail žáka.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await fetchWithAuth<StudentRecord | { data?: StudentRecord }>(
        "PATCH",
        `/students/${studentId}/profile`,
        {
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            classSectionId: form.classSectionId || undefined,
            studentNumber: form.studentNumber,
            externalId: form.externalId,
          },
        },
      );
      const next = unwrap(updated);
      if (next) setStudent(next);
      setOpen(false);
      showToastOnce("Údaje žáka byly uloženy.", { type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Údaje žáka se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mx-4 mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:mx-6 sm:mt-6 sm:p-5" data-testid="student-admin-editor">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">Údaje žáka</p>
          {!loading && currentEnrollment && (
            <p className="mt-0.5 text-sm text-slate-500">
              Třída {classLabel(currentEnrollment.classSection)}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant={open ? "outline" : "default"}
          size="sm"
          className="min-h-10 shrink-0"
          onClick={() => setOpen((value) => !value)}
          disabled={loading || !student}
        >
          {open ? <X className="mr-1.5 h-4 w-4" /> : <Pencil className="mr-1.5 h-4 w-4" />}
          {open ? "Zavřít" : "Upravit"}
        </Button>
      </div>

      {loading && <p className="mt-3 text-sm text-slate-500">Načítám…</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}

      {open && student && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Jméno a příjmení</span>
            <Input aria-label="Jméno a příjmení žáka" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">E-mail</span>
            <Input aria-label="E-mail žáka" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Třída</span>
            <select
              aria-label="Aktuální třída žáka"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={form.classSectionId}
              onChange={(e) => setForm((prev) => ({ ...prev, classSectionId: e.target.value }))}
            >
              <option value="" disabled>Vyberte třídu</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{classLabel(item)}</option>)}
            </select>
          </label>

          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-sm font-medium text-slate-600">
              Další údaje
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Číslo žáka</span>
                <Input aria-label="Číslo žáka" value={form.studentNumber} onChange={(e) => setForm((prev) => ({ ...prev, studentNumber: e.target.value }))} placeholder="Volitelné" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Externí ID</span>
                <Input aria-label="Externí ID žáka" value={form.externalId} onChange={(e) => setForm((prev) => ({ ...prev, externalId: e.target.value }))} placeholder="Volitelné" />
              </label>
            </div>
          </details>

          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={saving}>Zrušit</Button>
            <Button type="button" className="min-h-11" onClick={() => void save()} disabled={saving}>
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
