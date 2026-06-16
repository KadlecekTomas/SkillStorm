"use client";

import type { JSX, ReactNode } from "react";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import { OrganizationGate } from "@/components/onboarding/OrganizationGate";
import { BootstrapGate } from "@/components/onboarding/BootstrapGate";
import { AppReadinessGate } from "@/components/app-state/AppReadinessGate";
import { useAuth } from "@/hooks/use-auth";

/**
 * Focus group layout.
 *
 * Same auth/org/year invariants as the (school) group (so fetchWithAuth has a valid
 * org + academic-year context), but WITHOUT DashboardLayout — no sidebar, no year bar,
 * no global navigation. This is the chrome-free shell for distraction-free test taking.
 */
export default function FocusGroupLayout({
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
          <AppReadinessGate>{children}</AppReadinessGate>
        </BootstrapGate>
      </OrganizationGate>
    </GuardBoundary>
  );
}
