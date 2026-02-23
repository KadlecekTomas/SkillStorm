"use client";

import type { JSX, ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import { OrganizationGate } from "@/components/onboarding/OrganizationGate";
import { BootstrapGate } from "@/components/onboarding/BootstrapGate";
import { AppReadinessGate } from "@/components/app-state/AppReadinessGate";
import { useAuth } from "@/hooks/use-auth";

/**
 * Layout gate order (invariant-preserving).
 * Auth invariant: logout is a hard boundary. No protected component may render after logout.
 * 0. isLoggingOut → return null (no hooks, no fetch, no app logic)
 * 1. GuardBoundary: auth + no-org → redirect / NoOrganizationScreen
 * 2. OrganizationGate: hasOrganization required for app
 * 3. BootstrapGate: MainLayout + DashboardHeader (Logout always visible), then setup or AppReadinessGate
 * 4. AppReadinessGate: AppState === READY only → else dedicated state screen (no domain modules)
 */
export default function AppGroupLayout({
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
            <DashboardLayout>{children}</DashboardLayout>
          </AppReadinessGate>
        </BootstrapGate>
      </OrganizationGate>
    </GuardBoundary>
  );
}
