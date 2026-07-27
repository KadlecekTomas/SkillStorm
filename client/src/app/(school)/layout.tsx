"use client";

import type { JSX, ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import { OrganizationGate } from "@/components/onboarding/OrganizationGate";
import { BootstrapGate } from "@/components/onboarding/BootstrapGate";
import { AppReadinessGate } from "@/components/app-state/AppReadinessGate";
import { useAuth } from "@/hooks/use-auth";
import { StudentSessionBar } from "@/components/guardian/student-session-bar";

/**
 * School group layout.
 *
 * Gate order (invariant-preserving):
 * 0. isLoggingOut → return null (hard boundary: no hooks, no fetch after logout)
 * 1. GuardBoundary: auth check + no-org fallback (NoOrganizationScreen)
 * 2. OrganizationGate: active membership required
 * 3. BootstrapGate: academic year must exist
 * 4. AppReadinessGate: AppState === READY
 * 5. DashboardLayout: year bar + offline banner + school content
 *
 * Platform routes live in (platform) and never reach this layout.
 */
export default function SchoolGroupLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element | null {
  const { isLoggingOut } = useAuth();
  if (isLoggingOut) return null;

  return (
    <GuardBoundary>
      <OrganizationGate>
        <BootstrapGate>
          <AppReadinessGate>
            <StudentSessionBar />
            <DashboardLayout>{children}</DashboardLayout>
          </AppReadinessGate>
        </BootstrapGate>
      </OrganizationGate>
    </GuardBoundary>
  );
}
