"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { useRoleView } from "@/hooks/use-role-view";
import { Badge } from "@/components/ui/badge";
import { useAnalytics } from "@/hooks/use-analytics";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
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

/**
 * Renders only when AppReadinessGate has already determined AppState === READY.
 * No duplicate gating here; domain modules (children) are always safe to render.
 */
export const DashboardLayout = ({ children }: DashboardLayoutProps): React.JSX.Element => {
  const role = useRoleView();
  const { logEvent } = useAnalytics();
  const pathname = usePathname();
  const { user, org, logout, switchOrganization, isOffline, isLoading, hasOrganization, context } = useAuth();
  const memberships = user?.memberships ?? [];
  const activeMembershipId =
    memberships.find((m) => m.organizationId === org?.id)?.id ?? "";
  const { selectedYear, bootstrapState } = useAcademicYears();

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

  return (
    <MainLayout>
      <div className="space-y-3 rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-4">
            {context?.mode === "organization" && (
              <p className="text-base font-medium text-slate-700" aria-label="Aktuální školní rok">
                Školní rok{" "}
                {bootstrapState === "READY" && selectedYear
                  ? selectedYear.name
                  : bootstrapState === "LOADING" || bootstrapState === "INIT"
                    ? "…"
                    : selectedYear?.name ?? "—"}
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
        {context?.mode === "personal" && (
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
      {children}
    </MainLayout>
  );
};
