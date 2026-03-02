"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useAuth } from "@/hooks/use-auth";
import { fetchWithAuth } from "@/lib/http/client";
import {
  getPromotionStatus,
  getNextAcademicYear,
  promoteAcademicYear,
} from "@/lib/api/academic-years";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { showToastOnce } from "@/utils/toast";

type PromotionEligibility = {
  fromYearId: string;
  toYearId: string;
  toYearLabel: string;
};

function AcademicYearsPage(): React.JSX.Element {
  const router = useRouter();
  const { org, user } = useAuth();
  const {
    years,
    selectedYearId,
    setSelectedYearId,
    bootstrapState,
    loading,
    refresh,
    yearConfigError,
  } = useAcademicYears();
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [promotionEligibility, setPromotionEligibility] =
    useState<PromotionEligibility | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promoteSubmitting, setPromoteSubmitting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const canManage = user?.permissions?.includes(PermissionKey.MANAGE_TEACHERS) ?? false;
  const canPromote =
    user?.organizationRole === "DIRECTOR" || user?.organizationRole === "OWNER";
  const hasNoActiveYear = (bootstrapState === "READY" && years.length === 0) || yearConfigError != null;

  useEffect(() => {
    if (!canPromote || years.length === 0 || !selectedYearId) {
      setPromotionEligibility(null);
      return;
    }
    let cancelled = false;
    setPromotionLoading(true);
    const now = new Date();
    const pastYears = years.filter(
      (y) => y.endDate && new Date(y.endDate) < now && y.id !== selectedYearId,
    );
    const run = async () => {
      for (const year of pastYears) {
        if (cancelled) return;
        try {
          const next = await getNextAcademicYear(year.id);
          if (cancelled || !next || next.id !== selectedYearId) continue;
          const status = await getPromotionStatus(year.id);
          if (cancelled || status.promoted) continue;
          const toLabel =
            years.find((y) => y.id === selectedYearId)?.name ?? next.label;
          setPromotionEligibility({
            fromYearId: year.id,
            toYearId: next.id,
            toYearLabel: toLabel,
          });
          break;
        } catch {
          // ignore per-year errors
        }
      }
      if (!cancelled) setPromotionLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [canPromote, years, selectedYearId]);

  const handleCreateYear = async () => {
    if (!org?.id) return;
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      const now = new Date();
      const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const created = await fetchWithAuth<{ id: string }>("POST", "/academic-years", {
        body: { startYear, isActive: true },
      });
      const id = created && typeof created === "object" && "id" in created ? (created as { id: string }).id : null;
      if (id) {
        await refresh();
        setSelectedYearId(id);
      } else {
        throw new Error("Nepodařilo se vytvořit školní rok.");
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Nepodařilo se vytvořit školní rok.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handlePromoteConfirm = async () => {
    if (!promotionEligibility) return;
    setPromoteError(null);
    setPromoteSubmitting(true);
    try {
      const result = await promoteAcademicYear(
        promotionEligibility.fromYearId,
        promotionEligibility.toYearId,
      );
      showToastOnce(
        `Postup dokončen: ${result.classroomsCreated} tříd, ${result.studentsEnrolled} žáků.`,
        { type: "success" },
      );
      setPromoteModalOpen(false);
      setPromotionEligibility(null);
      await refresh();
      setSelectedYearId(promotionEligibility.toYearId);
      router.push(
        `/app/classrooms?year=${promotionEligibility.toYearId}&promoted=1`,
      );
    } catch (err) {
      setPromoteError(
        err instanceof Error ? err.message : "Postup ročníku se nezdařil.",
      );
    } finally {
      setPromoteSubmitting(false);
    }
  };

  if (!org?.id) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Pro nastavení školního roku zvol organizaci.</p>
        <Link href="/app">
          <Button variant="outline">Zpět na přehled</Button>
        </Link>
      </div>
    );
  }

  if (loading && years.length === 0) {
    return <LoadingSpinner label="Načítám školní roky" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/app/tests" className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Školní rok</h1>
        <p className="text-sm text-slate-500">
          Nastavení aktivního školního roku pro třídy a přiřazování testů.
        </p>
      </div>

      {(hasNoActiveYear || years.length === 0) && (
        <Card className="border-amber-200 bg-amber-50/50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Není nastaven aktivní školní rok</h2>
          <p className="mt-2 text-sm text-amber-800">
            Pro přiřazování testů třídám a práci s třídami je potřeba mít zvolený aktivní školní rok.
          </p>
          {canManage ? (
            <Button
              className="mt-4 bg-amber-700 hover:bg-amber-800"
              onClick={handleCreateYear}
              disabled={createSubmitting}
            >
              {createSubmitting ? "Vytvářím…" : "Nastavit školní rok"}
            </Button>
          ) : (
            <p className="mt-4 text-sm text-amber-800">
              Požádej ředitele nebo správce o vytvoření školního roku.
            </p>
          )}
          {createError && (
            <ErrorAlert className="mt-4" title="Chyba" description={createError} />
          )}
        </Card>
      )}

      {years.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">Vyber školní rok</h2>
          <p className="mt-1 text-sm text-slate-500">
            Aktivní rok se použije pro třídy a přiřazování testů.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {years.map((y) => (
              <Button
                key={y.id}
                variant={selectedYearId === y.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedYearId(y.id)}
              >
                {y.name}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {canPromote && !promotionLoading && promotionEligibility && (
        <Card className="border-slate-200 bg-slate-50/50 p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Postup do dalšího ročníku
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Zkopíruje třídy a žáky do školního roku {promotionEligibility.toYearLabel}.
            Tuto akci nelze vrátit.
          </p>
          <Button
            className="mt-4"
            variant="default"
            onClick={() => {
              setPromoteError(null);
              setPromoteModalOpen(true);
            }}
          >
            Postup do {promotionEligibility.toYearLabel}
          </Button>
        </Card>
      )}

      <Dialog open={promoteModalOpen} onOpenChange={setPromoteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potvrdit postup ročníku</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Třídy a žáci budou zkopírováni do školního roku{" "}
              <strong>{promotionEligibility?.toYearLabel}</strong>. Každá třída
              posune ročník (např. 6.A → 7.A).
            </p>
            <p className="font-medium text-amber-800">
              Tuto akci nelze vrátit.
            </p>
          </div>
          {promoteError && (
            <ErrorAlert title="Chyba" description={promoteError} />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromoteModalOpen(false)}
              disabled={promoteSubmitting}
            >
              Zrušit
            </Button>
            <Button
              onClick={handlePromoteConfirm}
              disabled={promoteSubmitting}
            >
              {promoteSubmitting ? "Probíhá…" : "Provést postup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-sm text-slate-500">
        <Link href="/app/classrooms" className="font-medium text-slate-700 underline hover:text-slate-900">
          Správa tříd
        </Link>
        {" · "}
        <Link href="/app/tests" className="font-medium text-slate-700 underline hover:text-slate-900">
          Testy
        </Link>
      </p>
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.VIEW_RESULTS],
})(AcademicYearsPage);
