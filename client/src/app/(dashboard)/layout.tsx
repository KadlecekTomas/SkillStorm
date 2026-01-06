"use client";

import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";

export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <GuardBoundary>
      <DashboardLayout>{children}</DashboardLayout>
    </GuardBoundary>
  );
}
