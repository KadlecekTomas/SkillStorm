"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

/**
 * School bootstrap gate: no /academic-years, /analytics, /audit until hasAcademicYear.
 * Always renders MainLayout + DashboardHeader (Logout visible). Then either "Setup školy" or children.
 */
export function BootstrapGate({ children }: { children: ReactNode }): ReactNode {
  const { context, org } = useAuth();
  const mode = context?.mode ?? "personal";
  const bootstrap = org?.bootstrap;
  const needsSchoolSetup =
    mode === "organization" &&
    org?.status === "ACTIVE" &&
    bootstrap?.hasAcademicYear === false;

  return (
    <MainLayout>
      <DashboardHeader />
      {needsSchoolSetup ? (
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-50 p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Setup školy
              </p>
              <h1 className="text-xl font-semibold text-slate-900">
                Příprava školy
              </h1>
            </div>
          </div>
          <p className="text-slate-700">
            Pro pokračování je potřeba nastavit školní rok. Poté budete moci vytvořit první třídu.
          </p>
          <Button asChild className="w-full" size="lg">
            <Link href="/onboarding/academic-year">Nastavit školní rok</Link>
          </Button>
        </div>
      </Card>
    </div>
      ) : (
        children
      )}
    </MainLayout>
  );
}
