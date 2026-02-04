"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { useRoleView } from "@/hooks/use-role-view";
import { Badge } from "@/components/ui/badge";
import { useAnalytics } from "@/hooks/use-analytics";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export const DashboardLayout = ({ children }: DashboardLayoutProps): React.JSX.Element => {
  const role = useRoleView();
  const { logEvent } = useAnalytics();
  const pathname = usePathname();
  const { user, org, logout, switchOrganization, isOffline, isLoading, hasOrganization } = useAuth();
  const memberships = user?.memberships ?? [];
  const activeMembershipId =
    memberships.find((m) => m.organizationId === org?.id)?.id ?? "";
  const {
    selectedYear,
    yearConfigError,
    bootstrapState,
  } = useAcademicYears();

  useEffect(() => {
    if (!pathname) return;
    logEvent("navigation", "page_view", { path: pathname });
  }, [pathname, logEvent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "skillstorm_activeMembershipId" || !e.newValue) return;
      const currentId = memberships.find((m) => m.organizationId === org?.id)?.id ?? "";
      if (e.newValue !== currentId) {
        switchOrganization(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [org?.id, memberships, switchOrganization]);

  const shouldBlockChildren = hasOrganization && bootstrapState !== "READY";
  let blockedContent: React.ReactNode | null = null;
  if (hasOrganization && (bootstrapState === "LOADING" || bootstrapState === "INIT")) {
    blockedContent = (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600">Načítám aktivní školní rok…</p>
        </div>
      </div>
    );
  }
  if (hasOrganization && bootstrapState === "ERROR") {
    let title = "Konfigurační chyba";
    let description = "Aktivní školní rok není dostupný.";
    if (
      yearConfigError === "ACADEMIC_YEAR_INVARIANT_BROKEN" ||
      yearConfigError === "NO_ACTIVE_ACADEMIC_YEAR" ||
      yearConfigError === "MULTIPLE_ACTIVE_ACADEMIC_YEARS"
    ) {
      title = "Chybí aktivní školní rok";
      description =
        yearConfigError === "ACADEMIC_YEAR_INVARIANT_BROKEN"
          ? "Organizace nemá správně nastavený aktivní školní rok. Kontaktujte správce."
          : "V organizaci není nastaven aktivní školní rok. Kontaktujte ředitele nebo vlastníka školy. Pokud jste vlastník, měli byste být přesměrováni na stránku pro vytvoření školního roku.";
    } else if (yearConfigError === "ACTIVE_YEAR_FETCH_FAILED") {
      title = "Nelze načíst aktivní školní rok";
      description = "Zkontroluj připojení nebo to zkus znovu.";
    }
    blockedContent = (
      <div className="space-y-4">
        <Alert title={title} description={description} variant="warning" />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-3 rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-4">
            {hasOrganization && (
              <p className="text-base font-medium text-slate-700" aria-label="Aktuální školní rok">
                Školní rok{" "}
                {bootstrapState === "READY" && selectedYear
                  ? selectedYear.name
                  : bootstrapState === "LOADING" || bootstrapState === "INIT"
                    ? "…"
                    : "—"}
              </p>
            )}
            <div>
              <p className="text-sm text-slate-500">You are viewing the</p>
              <p className="text-lg font-semibold text-slate-900 capitalize">
                {role} experience
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {memberships.length > 1 && (
              <Select
                value={activeMembershipId}
                onValueChange={(value) => {
                  if (value && value !== activeMembershipId) {
                    void switchOrganization(value);
                  }
                }}
                disabled={isLoading}
              >
                <SelectTrigger className="w-52 rounded-2xl" aria-label="Organization">
                  <SelectValue placeholder="Vyber školu" />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((membership) => (
                    <SelectItem key={membership.id} value={membership.id}>
                      {membership.organization?.name ?? membership.organizationId}
                      {membership.role ? ` (${membership.role.toLowerCase()})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Badge variant="success" className="capitalize">
              {role}
            </Badge>
            <Button variant="outline" onClick={() => logout()}>
              Odhlásit se
            </Button>
          </div>
        </div>
        {isOffline && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2 text-sm font-medium text-amber-700">
            Pracujete offline. Akce odešleme, jakmile se znovu připojíte.
          </div>
        )}
        {!hasOrganization && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Nejsi připojen ke škole
                </p>
                <p className="text-sm text-slate-600">
                  Můžeš založit školu nebo se připojit pomocí kódu. Do té doby
                  jsou školní funkce nedostupné.
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/dashboard/onboarding">Založit nebo se připojit</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
      {shouldBlockChildren ? blockedContent : children}
    </MainLayout>
  );
};
