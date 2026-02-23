"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useAuth } from "@/hooks/use-auth";
import { fetchWithAuth } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";

function AcademicYearsPage(): React.JSX.Element {
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

  const canManage = user?.permissions?.includes(PermissionKey.MANAGE_TEACHERS) ?? false;
  const hasNoActiveYear = (bootstrapState === "READY" && years.length === 0) || yearConfigError != null;

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

  if (!org?.id) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Pro nastavení školního roku zvol organizaci.</p>
        <Link href="/dashboard">
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
        <Link href="/dashboard/tests" className="text-sm text-slate-500 hover:text-slate-700">
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
            <Alert className="mt-4" title="Chyba" description={createError} variant="warning" />
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

      <p className="text-sm text-slate-500">
        <Link href="/dashboard/classrooms" className="font-medium text-slate-700 underline hover:text-slate-900">
          Správa tříd
        </Link>
        {" · "}
        <Link href="/dashboard/tests" className="font-medium text-slate-700 underline hover:text-slate-900">
          Testy
        </Link>
      </p>
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.VIEW_RESULTS],
})(AcademicYearsPage);
