"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { useRoleView } from "@/hooks/use-role-view";
import { Badge } from "@/components/ui/badge";
import { useAnalytics } from "@/hooks/use-analytics";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
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
  const { user, org, logout, switchOrganization, isOffline, isLoading } = useAuth();
  const memberships = user?.memberships ?? [];

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
                <SelectTrigger className="w-52 rounded-2xl" aria-label="Organizace">
                  <SelectValue placeholder="Vyber organizaci" />
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
      </div>
      {children}
    </MainLayout>
  );
};
