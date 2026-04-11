"use client";

import { useAnalytics } from "@/hooks/use-analytics";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { usePermissions } from "@/hooks/use-permissions";
import { AcademicYearExpiredModal } from "@/components/layout/AcademicYearExpiredModal";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

/**
 * Renders only when AppReadinessGate has already determined AppState === READY.
 * Logout is in DashboardHeader (outside this gate). This layout only adds year line, offline, personal CTA, and children.
 */
export const DashboardLayout = ({ children }: DashboardLayoutProps): React.JSX.Element => {
  const { logEvent } = useAnalytics();
  const pathname = usePathname();
  const { user, org, switchOrganization, isOffline, context } = useAuth();
  const memberships = user?.memberships ?? [];
  const currentMembershipId = memberships.find((m) => m.organizationId === org?.id)?.id ?? "";
  const { selectedYear, bootstrapState, activeYear, isAcademicYearExpired, refresh: refreshYears } = useAcademicYears();
  const { hasRole } = usePermissions();
  const [expiredModalDismissed, setExpiredModalDismissed] = useState(false);
  // Only directors/owners see the expired-year modal. They are the only ones who
  // can take action (create/activate the next year). Teachers should never be
  // interrupted by this modal — the auto-rollover service handles it automatically,
  // and the backend guard gives a clear error if they happen to write during the
  // brief window between expiry and rollover.
  const isManager = hasRole("DIRECTOR") || hasRole("OWNER");
  const showExpiredModal =
    isAcademicYearExpired && bootstrapState === "READY" && !expiredModalDismissed && isManager;

  useEffect(() => {
    if (!pathname) return;
    void logEvent("navigation", "page_view", { path: pathname }).catch(() => {});
  }, [pathname, logEvent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "skillstorm_activeMembershipId" || !e.newValue) return;
      if (e.newValue !== currentMembershipId) {
        switchOrganization(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [currentMembershipId, switchOrganization]);

  return (
    <div className="space-y-6">
      {showExpiredModal && activeYear && (
        <AcademicYearExpiredModal
          expiredYearId={activeYear.id}
          expiredYearName={activeYear.name}
          onClose={() => setExpiredModalDismissed(true)}
          onYearCreated={() => {
            setExpiredModalDismissed(true);
            void refreshYears();
          }}
        />
      )}
      <div className="space-y-3 rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-4">
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
                <Link href="/app/onboarding">Založit nebo se připojit</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
};
