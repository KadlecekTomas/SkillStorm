"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { BaseModal } from "@/components/modals/base-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { httpClient, HttpError } from "@/lib/http/client";
import { PermissionKey, type AcademicYear } from "@/types";
import { showToastOnce } from "@/utils/toast";
import { useCurrentAcademicYearState } from "@/store/use-current-academic-year-state";

type CurrentAcademicYearRequiredScreenProps = {
  onRecovered?: () => Promise<void> | void;
};

type AcademicYearListItem = AcademicYear;

const toDateInputValue = (value: Date): string => value.toISOString().slice(0, 10);

function suggestSchoolYearPeriod(): { label: string; startsAt: string; endsAt: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 8 ? currentYear : currentYear - 1;
  const startsAt = new Date(Date.UTC(startYear, 8, 1));
  const endsAt = new Date(Date.UTC(startYear + 1, 7, 31));
  return {
    label: `${startYear}/${startYear + 1}`,
    startsAt: toDateInputValue(startsAt),
    endsAt: toDateInputValue(endsAt),
  };
}

function normalizeApiMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    const data = error.data as { message?: string; meta?: { message?: string } } | undefined;
    return data?.message ?? data?.meta?.message ?? error.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export function CurrentAcademicYearRequiredScreen({
  onRecovered,
}: CurrentAcademicYearRequiredScreenProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { org, syncProfile } = useAuth();
  const { can } = usePermissions();
  const [years, setYears] = useState<AcademicYearListItem[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [activateSubmitting, setActivateSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [selectedExistingYearId, setSelectedExistingYearId] = useState<string>("");
  const defaults = useMemo(() => suggestSchoolYearPeriod(), []);
  const [label, setLabel] = useState(defaults.label);
  const [startsAt, setStartsAt] = useState(defaults.startsAt);
  const [endsAt, setEndsAt] = useState(defaults.endsAt);
  const markAvailable = useCurrentAcademicYearState((state) => state.markAvailable);

  const canManageAcademicYears = can(PermissionKey.MANAGE_TEACHERS);
  const hasExistingYears = years.length > 0;

  const loadYears = useCallback(async () => {
    if (!org?.id) {
      setYears([]);
      setLoadingYears(false);
      return;
    }
    setLoadingYears(true);
    try {
      const list = await httpClient.get<AcademicYearListItem[]>("/academic-years", {
        cache: "no-store",
      });
      setYears(list ?? []);
      setSelectedExistingYearId((current) => current || list?.[0]?.id || "");
    } catch {
      setYears([]);
    } finally {
      setLoadingYears(false);
    }
  }, [org?.id]);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  const handleRecovered = useCallback(async () => {
    if (!org?.id) return;
    markAvailable(org.id);
    await syncProfile({ force: true });
    await onRecovered?.();
    router.replace(pathname || "/app");
    router.refresh();
  }, [markAvailable, onRecovered, org?.id, pathname, router, syncProfile]);

  const handleCreate = useCallback(async () => {
    if (!org?.id) return;
    setCreateSubmitting(true);
    setFormError(null);
    try {
      const startDate = new Date(`${startsAt}T00:00:00.000Z`);
      const endDate = new Date(`${endsAt}T00:00:00.000Z`);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        setFormError("Vyplňte platné datum začátku a konce školního roku.");
        return;
      }
      if (startDate >= endDate) {
        setFormError("Datum začátku musí být před datem konce.");
        return;
      }

      const expectedLabel = `${startDate.getUTCFullYear()}/${startDate.getUTCFullYear() + 1}`;
      if (label.trim() !== expectedLabel) {
        setFormError(`Popisek musí odpovídat období ${expectedLabel}.`);
        return;
      }

      await httpClient.post("/academic-years", {
        startYear: startDate.getUTCFullYear(),
        isActive: true,
      });
      setCreateOpen(false);
      showToastOnce("Školní rok byl vytvořen.", { type: "success" });
      await handleRecovered();
    } catch (error) {
      setFormError(normalizeApiMessage(error, "Nepodařilo se vytvořit školní rok."));
    } finally {
      setCreateSubmitting(false);
    }
  }, [endsAt, handleRecovered, label, org?.id, startsAt]);

  const handleActivate = useCallback(async () => {
    if (!selectedExistingYearId) {
      setActivationError("Vyberte školní rok, který chcete aktivovat.");
      return;
    }
    setActivateSubmitting(true);
    setActivationError(null);
    try {
      await httpClient.request("PATCH", `/academic-years/${encodeURIComponent(selectedExistingYearId)}/activate`);
      setActivateOpen(false);
      showToastOnce("Školní rok byl aktivován.", { type: "success" });
      await handleRecovered();
    } catch (error) {
      setActivationError(normalizeApiMessage(error, "Nepodařilo se aktivovat školní rok."));
    } finally {
      setActivateSubmitting(false);
    }
  }, [handleRecovered, selectedExistingYearId]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl border-slate-200 p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Škola nemá nastavený aktuální školní rok
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Pro práci s třídami, testy a výsledky je potřeba nastavit aktuální školní rok.
              </p>
            </div>
          </div>

          {!canManageAcademicYears && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Aktuální školní rok může nastavit pouze ředitel nebo vlastník školy.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              className="rounded-xl"
              size="lg"
              onClick={() => setCreateOpen(true)}
              disabled={!canManageAcademicYears}
            >
              Vytvořit školní rok
            </Button>
            {hasExistingYears && (
              <Button
                variant="outline"
                className="rounded-xl"
                size="lg"
                onClick={() => setActivateOpen(true)}
                disabled={!canManageAcademicYears}
              >
                Vybrat existující rok
              </Button>
            )}
          </div>

          {loadingYears ? (
            <LoadingSpinner label="Načítám dostupné školní roky…" />
          ) : hasExistingYears ? (
            <p className="text-sm text-slate-500">
              V organizaci už existuje {years.length === 1 ? "1 školní rok" : `${years.length} školních roků`}.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              V organizaci zatím není žádný školní rok. Vytvořte první a nastavte ho jako aktuální.
            </p>
          )}
        </div>
      </Card>

      <BaseModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormError(null);
        }}
        title="Vytvořit školní rok"
        description="Vyplňte období školního roku. Nový rok bude po vytvoření aktivní."
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Popisek
            <Input
              className="mt-2"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="2025/2026"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Začátek
              <Input
                className="mt-2"
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Konec
              <Input
                className="mt-2"
                type="date"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </label>
          </div>
          {formError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Zrušit
            </Button>
            <Button onClick={() => void handleCreate()} disabled={createSubmitting || !canManageAcademicYears}>
              {createSubmitting ? "Vytvářím…" : "Vytvořit školní rok"}
            </Button>
          </div>
        </div>
      </BaseModal>

      <BaseModal
        open={activateOpen}
        onOpenChange={(open) => {
          setActivateOpen(open);
          if (!open) setActivationError(null);
        }}
        title="Vybrat existující rok"
        description="Vyberte školní rok, který má být nastaven jako aktuální."
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Školní rok
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={selectedExistingYearId}
              onChange={(event) => setSelectedExistingYearId(event.target.value)}
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </label>
          {activationError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {activationError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setActivateOpen(false)} disabled={activateSubmitting}>
              Zrušit
            </Button>
            <Button onClick={() => void handleActivate()} disabled={activateSubmitting || !canManageAcademicYears}>
              {activateSubmitting ? "Aktivuji…" : "Aktivovat rok"}
            </Button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
