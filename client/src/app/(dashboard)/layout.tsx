"use client";

import type { JSX, ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";

export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <GuardBoundary>
      <DashboardLayout>{children}</DashboardLayout>
    </GuardBoundary>
  );
}
