"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { showToastOnce } from "@/utils/toast";
import type { AssignabilityReport } from "@/types/assignability";
import { formatAllowedGrades, gradeLabel } from "@/lib/grades";

type ClassSection = { id: string; label?: string | null; grade?: string; section?: string };

export type AssignToClassModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testId: string | null;
  allowedGrades: string[];
  /** Active academic year id for fetching class sections */
  yearId: string | null;
  onSuccess?: () => void;
};

const defaultOpen = () => new Date().toISOString();
const defaultClose = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

export function AssignToClassModal({
  open,
  onOpenChange,
  testId,
  allowedGrades,
  yearId,
  onSuccess,
}: AssignToClassModalProps): React.JSX.Element {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignErrorDetails, setAssignErrorDetails] = useState<AssignabilityReport | null>(null);
  const [form, setForm] = useState({
    classSectionId: "",
    openAt: defaultOpen().slice(0, 16),
    closeAt: defaultClose().slice(0, 16),
    maxAttempts: 1,
  });

  useEffect(() => {
    if (!open || !yearId) {
      setClasses([]);
      setAssignErrorDetails(null);
      return;
    }
    setLoading(true);
    setError(null);
    setAssignErrorDetails(null);
    fetchWithAuth<ClassSection[] | { data?: ClassSection[] }>("GET", "/class-sections", {
      query: { yearId },
    })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data && typeof data === "object" && "data" in data ? (data as { data?: ClassSection[] }).data : null) ?? [];
        setClasses(Array.isArray(list) ? list : []);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Nepodařilo se načíst třídy");
        setClasses([]);
      })
      .finally(() => setLoading(false));
  }, [open, yearId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testId || !form.classSectionId) {
      setError("Vyber třídu.");
      return;
    }
    const selectedClass = classes.find((item) => item.id === form.classSectionId);
    if (selectedClass?.grade && !allowedGrades.includes(selectedClass.grade)) {
      setError(`Test je určen pro ročníky ${formatAllowedGrades(allowedGrades)}.`);
      return;
    }
    const openDate = new Date(form.openAt);
    const closeDate = new Date(form.closeAt);
    if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
      setError("Zadejte platné datum otevření a uzavření.");
      return;
    }
    if (openDate >= closeDate) {
      setError("Datum otevření musí být před datem uzavření.");
      return;
    }
    setError(null);
    setAssignErrorDetails(null);
    setSubmitting(true);
    try {
      await fetchWithAuth("POST", `/tests/${testId}/assign`, {
        body: {
          classSectionId: form.classSectionId,
          openAt: new Date(form.openAt).toISOString(),
          closeAt: new Date(form.closeAt).toISOString(),
          maxAttempts: Math.max(1, Number(form.maxAttempts) || 1),
          shuffle: true,
          showExplain: "after_close",
        },
      });
      showToastOnce("Test byl zadán třídě.", { type: "success" });
      onSuccess?.();
      onOpenChange(false);
      setForm({
        classSectionId: "",
        openAt: defaultOpen().slice(0, 16),
        closeAt: defaultClose().slice(0, 16),
        maxAttempts: 1,
      });
    } catch (e: unknown) {
      const isHttp = e instanceof HttpError;
      const status = isHttp ? e.status : 0;
      const data = isHttp && e.data && typeof e.data === "object" ? (e.data as Record<string, unknown>) : null;
      const code = data?.code as string | undefined;
      const message = (data?.message as string) ?? (e instanceof Error ? e.message : null);

      if (status === 403) {
        setAssignErrorDetails(null);
        setError(typeof message === "string" && message.length > 0 ? message : "Nemáte oprávnění přiřadit tento test.");
      } else if (status === 409 || code === "TEST_NOT_ASSIGNABLE") {
        const details = data?.details as AssignabilityReport | undefined;
        if (details && typeof details === "object" && Array.isArray(details.issues)) {
          setAssignErrorDetails(details);
          setError("Test není připraven k přiřazení.");
        } else {
          setAssignErrorDetails(null);
          setError(typeof message === "string" && message.length > 0 ? message : "Test není připraven k přiřazení.");
        }
      } else {
        setAssignErrorDetails(null);
        if (typeof message === "string" && message.length > 0) {
          setError(message === "Test contains unscorable questions"
            ? "Test obsahuje otázky bez bodového hodnocení nebo správné odpovědi."
            : message);
        } else {
          setError("Přiřazení testu se nepovedlo. Zkuste to znovu.");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const labelFor = (c: ClassSection) => (c.label ?? [c.grade, c.section].filter(Boolean).join(" ")) || c.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Přiřadit test třídě</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!yearId && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/80 py-6 px-4 text-center">
              <h3 className="text-base font-semibold text-amber-900">Není nastaven aktivní školní rok</h3>
              <p className="mt-2 text-sm text-amber-800">
                Pro přiřazení testu třídě je potřeba zvolit aktivní školní rok.
              </p>
              <Link href="/app/academic-years" onClick={() => onOpenChange(false)}>
                <Button type="button" className="mt-4 bg-amber-700 hover:bg-amber-800">
                  Nastavit školní rok
                </Button>
              </Link>
            </div>
          )}
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Určeno pro ročníky:</span>{" "}
            {formatAllowedGrades(allowedGrades)}
          </div>
          <div className="space-y-2">
            <label htmlFor="assign-class" className="text-sm font-medium text-slate-700">Třída</label>
            <select
              id="assign-class"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={form.classSectionId}
              onChange={(e) => setForm((p) => ({ ...p, classSectionId: e.target.value }))}
              disabled={loading || !yearId}
            >
              <option value="">Vyber třídu</option>
              {classes.map((c) => {
                const eligible = !c.grade || allowedGrades.includes(c.grade);
                return (
                  <option key={c.id} value={c.id} disabled={!eligible}>
                    {eligible ? labelFor(c) : `${labelFor(c)} · mimo allowedGrades (${gradeLabel(c.grade ?? "")})`}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="assign-open" className="text-sm font-medium text-slate-700">Otevřeno od</label>
            <Input
              id="assign-open"
              type="datetime-local"
              value={form.openAt}
              onChange={(e) => setForm((p) => ({ ...p, openAt: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="assign-close" className="text-sm font-medium text-slate-700">Otevřeno do</label>
            <Input
              id="assign-close"
              type="datetime-local"
              value={form.closeAt}
              onChange={(e) => setForm((p) => ({ ...p, closeAt: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="assign-attempts" className="text-sm font-medium text-slate-700">Max. počet pokusů</label>
            <Input
              id="assign-attempts"
              type="number"
              min={1}
              value={form.maxAttempts}
              onChange={(e) => setForm((p) => ({ ...p, maxAttempts: parseInt(e.target.value, 10) || 1 }))}
            />
          </div>
          {error && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-600">
                {assignErrorDetails ? "⚠ " : ""}{error}
              </p>
              {assignErrorDetails && (
                <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
                  {assignErrorDetails.issues.some((i) => i.reason === "NO_QUESTIONS") && (
                    <li>Test neobsahuje otázky</li>
                  )}
                  {(() => {
                    const noScoreCount = assignErrorDetails.issues.filter((i) => i.reason === "NO_SCORE").length;
                    return noScoreCount > 0 ? (
                      <li>Otázky bez bodů: {noScoreCount}</li>
                    ) : null;
                  })()}
                  {(() => {
                    const noAnswerCount = assignErrorDetails.issues.filter((i) => i.reason === "NO_CORRECT_ANSWER").length;
                    return noAnswerCount > 0 ? (
                      <li>Otázky bez správné odpovědi: {noAnswerCount}</li>
                    ) : null;
                  })()}
                  <li>Celkem bodů: {assignErrorDetails.totalPoints}</li>
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" disabled={submitting || loading || !yearId}>
              {submitting ? "Přiřazuji…" : "Přiřadit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
