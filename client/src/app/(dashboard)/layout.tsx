"use client";

import type { JSX, ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import { OrganizationGate } from "@/components/onboarding/OrganizationGate";
import { AcademicYearGate } from "@/components/onboarding/AcademicYearGate";

export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <GuardBoundary>
      <OrganizationGate>
        <AcademicYearGate>
          <DashboardLayout>{children}</DashboardLayout>
        </AcademicYearGate>
      </OrganizationGate>
    </GuardBoundary>
  );
}
