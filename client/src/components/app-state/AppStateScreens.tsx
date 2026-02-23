"use client";

import { AlertCircle, Calendar, Building2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PendingOrganizationOnboardingScreen } from "@/components/onboarding/PendingOrganizationOnboardingScreen";
import type { AppState } from "@/lib/app-state/app-state";
import { BACKEND_STATE_CODES } from "@/lib/app-state/app-state";
import Link from "next/link";

type AppStateScreensProps = {
  state: AppState;
  onRetry?: () => Promise<void>;
};

/**
 * Renders the dedicated state screen for the current AppState.
 * Never shows generic "insufficient permissions"; each state has explicit WHAT / WHO / action.
 *
 * Domain rule: ORG_SUSPENDED is a HARD BLOCK. No retry button, no onboarding CTA, no repair.
 * SUSPENDED ≠ PENDING (never treat as "pending approval").
 */
export function AppStateScreens({ state, onRetry }: AppStateScreensProps): React.JSX.Element {
  if (state.code === "BOOTSTRAPPING") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="space-y-4 text-center">
          <LoadingSpinner label="Načítám stav aplikace…" />
        </div>
      </div>
    );
  }

  if (state.code === "ORG_PENDING") {
    return <PendingOrganizationOnboardingScreen />;
  }

  if (state.code === "ORG_SUSPENDED") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl border-slate-200 p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Organizace je pozastavena</h1>
                <p className="text-sm text-slate-600">Přístup k aplikaci je dočasně nedostupný.</p>
              </div>
            </div>
            <InfoAlert
              title="Co to znamená"
              description="Vaše škola byla pozastavena správcem platformy. Pro obnovení přístupu kontaktujte podporu nebo správce."
            />
          </div>
        </Card>
      </div>
    );
  }

  if (state.code === "ORG_NOT_READY") {
    const isMultiple =
      state.errorCode === BACKEND_STATE_CODES.MULTIPLE_CURRENT_ACADEMIC_YEARS ||
      state.errorCode === BACKEND_STATE_CODES.MULTIPLE_ACTIVE_ACADEMIC_YEARS;
    const isNoClassSection = state.errorCode === BACKEND_STATE_CODES.NO_CLASS_SECTION;
    const isClassNotInCurrentYear =
      state.errorCode === BACKEND_STATE_CODES.CLASS_NOT_IN_CURRENT_YEAR ||
      state.errorCode === BACKEND_STATE_CODES.CLASS_NOT_IN_ACTIVE_YEAR;

    if (isClassNotInCurrentYear) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-xl border-slate-200 p-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">Přiřazení tříd ke školnímu roku</h1>
                  <p className="text-sm text-slate-600">
                    Škola má vytvořené třídy, ale žádná není přiřazena k aktivnímu školnímu roku.
                  </p>
                </div>
              </div>
              <Button asChild className="w-full rounded-xl" size="lg">
                <Link href="/app/classrooms">Přiřadit třídy ke školnímu roku</Link>
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    if (isNoClassSection) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-xl border-slate-200 p-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">Příprava školy</h1>
                  <p className="text-sm text-slate-600">
                    Škola je aktivní a má školní rok. Pro pokračování vytvořte alespoň jednu třídu.
                  </p>
                </div>
              </div>
              <Button asChild className="w-full rounded-xl" size="lg">
                <Link href="/app/classrooms">Vytvořit první třídu pro školní rok</Link>
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    if (isMultiple) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-xl border-slate-200 p-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">Konflikt školních roků</h1>
                  <p className="text-sm text-slate-600">V organizaci je nastaveno více aktivních školních roků.</p>
                </div>
              </div>
              <InfoAlert
                title="Kdo to může vyřešit"
                description="Tuto situaci může opravit pouze ředitel nebo vlastník školy (např. v nastavení nebo přes podporu). Po nápravě obnovte stránku."
              />
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl border-slate-200 p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Chybí aktivní školní rok</h1>
                <p className="text-sm text-slate-600">Aby bylo možné pracovat s třídami a testy, musí být nastaven právě jeden aktivní školní rok.</p>
              </div>
            </div>
            <InfoAlert
              title="Kdo to může vyřešit"
              description="Vlastník nebo ředitel školy může vytvořit školní rok na stránce nastavení. Po vytvoření obnovte stránku."
            />
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/onboarding/academic-year">Přejít na vytvoření školního roku</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (state.code === "ERROR") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl border-slate-200 p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Nelze načíst stav aplikace</h1>
                <p className="text-sm text-slate-600">
                  Došlo k technické chybě. Zkontrolujte připojení a zkuste to znovu.
                </p>
              </div>
            </div>
            {onRetry && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => void onRetry()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Zkusit znovu
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return <></>;
}
