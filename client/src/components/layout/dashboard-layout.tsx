"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { useRoleView } from "@/hooks/use-role-view";
import { Badge } from "@/components/ui/badge";
import { useProtectedRoute } from "@/hooks/use-protected-route";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  useProtectedRoute();
  const role = useRoleView();

  return (
    <MainLayout>
      <div className="flex items-center justify-between rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-4">
        <div>
          <p className="text-sm text-slate-500">You are viewing the</p>
          <p className="text-lg font-semibold text-slate-900 capitalize">
            {role} experience
          </p>
        </div>
        <Badge variant="success" className="capitalize">
          {role}
        </Badge>
      </div>
      {children}
    </MainLayout>
  );
};
