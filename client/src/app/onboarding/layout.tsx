"use client";

import type { ReactNode } from "react";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import { OnboardingRouteGuard } from "@/components/onboarding/OnboardingRouteGuard";

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <GuardBoundary>
      <OnboardingRouteGuard>{children}</OnboardingRouteGuard>
    </GuardBoundary>
  );
}
