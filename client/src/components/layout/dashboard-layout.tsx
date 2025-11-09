"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { useRoleView } from "@/hooks/use-role-view";
import { Badge } from "@/components/ui/badge";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useAnalytics } from "@/hooks/use-analytics";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/use-auth-store";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  useProtectedRoute();
  const role = useRoleView();
  const { logEvent } = useAnalytics();
  const pathname = usePathname();
  const router = useRouter();
  const logoutStore = useAuthStore((state) => state.logout);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors on logout
    } finally {
      if (typeof window !== "undefined") {
        localStorage.clear();
      }
      logoutStore();
      router.push("/login");
    }
  }, [logoutStore, router]);

  useEffect(() => {
    if (!pathname) return;
    logEvent("navigation", "page_view", { path: pathname });
  }, [pathname, logEvent]);

  return (
    <MainLayout>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-4">
        <div>
          <p className="text-sm text-slate-500">You are viewing the</p>
          <p className="text-lg font-semibold text-slate-900 capitalize">
            {role} experience
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" className="capitalize">
            {role}
          </Badge>
          <Button variant="outline" onClick={handleLogout}>
            Odhlásit se
          </Button>
        </div>
      </div>
      {children}
    </MainLayout>
  );
};
