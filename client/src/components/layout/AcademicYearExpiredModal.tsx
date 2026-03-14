"use client";

import { useEffect, useState } from "react";
import { BaseModal } from "@/components/modals/base-modal";
import { Button } from "@/components/ui/button";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { getNextAcademicYear } from "@/lib/api/academic-years";
import { usePermissions } from "@/hooks/use-permissions";

type Props = {
  expiredYearId: string;
  expiredYearName: string;
  onClose: () => void;
  onYearCreated: () => void;
};

/** Czech school year starting Sept 1. Returns startYear and label for the year that covers today. */
function suggestCurrentSchoolYear(): { startYear: number; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  const startYear = month >= 9 ? year : year - 1;
  return { startYear, label: `${startYear}/${startYear + 1}` };
}

export function AcademicYearExpiredModal({
  expiredYearId,
  expiredYearName,
  onClose,
  onYearCreated,
}: Props): React.JSX.Element {
  const { hasRole } = usePermissions();
  const isDirector = hasRole("DIRECTOR") || hasRole("OWNER");

  const { startYear, label: suggestedLabel } = suggestCurrentSchoolYear();

  // Pre-created next year (by cron or director). Null = not pre-created. Undefined = still loading.
  const [preparedYear, setPreparedYear] = useState<{ id: string; label: string } | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount, check if the cron already pre-created the next year.
  // If it has, we should "Activate" rather than "Create" to avoid hitting @@unique(orgId, label).
  useEffect(() => {
    getNextAcademicYear(expiredYearId)
      .then((next) => setPreparedYear(next ?? null))
      .catch(() => setPreparedYear(null)); // fallback: assume not pre-created
  }, [expiredYearId]);

  const handleActivate = async (yearId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await fetchWithAuth("PATCH", `/academic-years/${yearId}/activate`);
      onYearCreated();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to activate academic year:", err);
      }
      const msg =
        err instanceof HttpError
          ? ((err.data as { message?: string } | undefined)?.message ?? err.message)
          : "Nepodařilo se aktivovat školní rok.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Create the new year. When an expired year is still isCurrent=true the service
      // will not auto-set the new year as current (existingCurrent is found). We must
      // explicitly activate it afterwards so the expired year stops being "current".
      const created = await fetchWithAuth<{ id: string; isActive: boolean }>("POST", "/academic-years", {
        body: { startYear },
      });
      if (!created.isActive) {
        await fetchWithAuth("PATCH", `/academic-years/${created.id}/activate`);
      }
      onYearCreated();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to create academic year:", err);
      }
      const msg =
        err instanceof HttpError
          ? ((err.data as { message?: string } | undefined)?.message ?? err.message)
          : "Nepodařilo se vytvořit školní rok.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state while we check for pre-created year
  const isChecking = preparedYear === undefined;

  return (
    <BaseModal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Školní rok skončil"
      description={`Školní rok ${expiredYearName} již skončil.`}
    >
      {isDirector ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {preparedYear
              ? `Školní rok ${preparedYear.label} je připraven. Chcete ho aktivovat?`
              : "Chcete vytvořit nový školní rok a pokračovat v práci?"}
          </p>
          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="flex gap-3">
            {preparedYear ? (
              <Button
                onClick={() => void handleActivate(preparedYear.id)}
                disabled={submitting || isChecking}
                className="rounded-2xl"
              >
                {submitting ? "Aktivace…" : `Aktivovat ${preparedYear.label}`}
              </Button>
            ) : (
              <Button
                onClick={() => void handleCreate()}
                disabled={submitting || isChecking}
                className="rounded-2xl"
              >
                {submitting ? "Vytváření…" : isChecking ? "…" : `Vytvořit ${suggestedLabel}`}
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded-2xl">
              Zavřít
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Školní rok není aktuální. Kontaktujte vedení školy pro vytvoření nového roku.
          </p>
          <Button variant="outline" onClick={onClose} className="rounded-2xl">
            Zavřít
          </Button>
        </div>
      )}
    </BaseModal>
  );
}
