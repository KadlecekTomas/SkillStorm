"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { useRoleView } from "@/hooks/use-role-view";
import { Badge } from "@/components/ui/badge";
import { useAnalytics } from "@/hooks/use-analytics";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export const DashboardLayout = ({ children }: DashboardLayoutProps): React.JSX.Element => {
  const role = useRoleView();
  const { logEvent } = useAnalytics();
  const pathname = usePathname();
  const { user, org, logout, switchOrganization, isOffline, isLoading, hasOrganization } = useAuth();
  const memberships = user?.memberships ?? [];
  const {
    years,
    selectedYear,
    isReadOnly,
    setSelectedYearId,
    loading: yearsLoading,
  } = useAcademicYears();

  useEffect(() => {
    if (!pathname) return;
    logEvent("navigation", "page_view", { path: pathname });
  }, [pathname, logEvent]);

  return (
    <MainLayout>
      <div className="space-y-3 rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">You are viewing the</p>
            <p className="text-lg font-semibold text-slate-900 capitalize">
              {role} experience
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {memberships.length > 1 && (
              <Select
                value={org?.id ?? ""}
                onValueChange={(value) => {
                  if (value !== org?.id) {
                    void switchOrganization(value);
                  }
                }}
                disabled={isLoading}
              >
                <SelectTrigger className="w-52 rounded-2xl" aria-label="Organization">
                  <SelectValue placeholder="Vyber školu" />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((membership) => (
                    <SelectItem key={membership.organizationId} value={membership.organizationId}>
                      {membership.organization?.name ?? membership.organizationId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasOrganization && years.length > 0 && (
              <Select
                value={selectedYear?.id ?? ""}
                onValueChange={(value) => setSelectedYearId(value)}
                disabled={yearsLoading}
              >
                <SelectTrigger className="w-48 rounded-2xl" aria-label="Academic year">
                  <SelectValue placeholder="Školní rok" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name}
                      {!year.isActive ? " · read-only" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasOrganization && selectedYear && isReadOnly && (
              <Badge variant="warning">Read-only rok</Badge>
            )}
            <Badge variant="success" className="capitalize">
              {role}
            </Badge>
            <Button variant="outline" onClick={() => logout()}>
              Odhlásit se
            </Button>
          </div>
        </div>
        {isOffline && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2 text-sm font-medium text-amber-700">
            Pracujete offline. Akce odešleme, jakmile se znovu připojíte.
          </div>
        )}
        {!hasOrganization && (
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
                <Link href="/dashboard/onboarding">Založit nebo se připojit</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
      {children}
    </MainLayout>
  );
};
