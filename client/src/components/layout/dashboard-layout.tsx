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
  // Guardian audit: rodič nemá školní RBAC klíče — /academic-years by
  // vrátilo 403. Lišta roku pro něj nemá význam (kontext nese karta dítěte).
  const isParent = user?.organizationRole === "PARENT";
  const { selectedYear, bootstrapState, activeYear, isAcademicYearExpired, refresh: refreshYears } = useAcademicYears({ enabled: !isParent });
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
      <div className="space-y-3">
        {context?.mode === "organization" && !isParent && (
          <p data-app-chrome className="text-sm font-medium text-ink-dim" aria-label="Aktuální školní rok">
            Školní rok{" "}
            {bootstrapState === "READY" && selectedYear
              ? selectedYear.name
              : bootstrapState === "LOADING" || bootstrapState === "INIT"
                ? "…"
                : selectedYear?.name ?? "—"}
          </p>
        )}
        {isOffline && (
          <div className="rounded-xl border border-streak/40 bg-streak/10 px-4 py-2 text-sm font-semibold text-ink">
            Pracujete offline. Akce odešleme, jakmile se znovu připojíte.
          </div>
        )}
        {context?.mode === "personal" && (
          <div className="rounded-xl border border-accent/30 bg-accent-soft/60 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-accent-deep">
                  Nejsi připojen ke škole
                </p>
                <p className="text-sm text-ink-muted">
                  Můžeš založit školu nebo se připojit pomocí kódu. Do té doby
                  jsou školní funkce nedostupné.
                </p>
              </div>
              <Button asChild variant="secondary">
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
