"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { DASHBOARD_ENTRY, isPlatformAdmin } from "@/utils/permissions";

type PlatformLayoutProps = {
  children: React.ReactNode;
};

const PlatformShell = (): React.JSX.Element => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-[320px] w-full" />
  </div>
);

export default function PlatformLayout({ children }: PlatformLayoutProps): React.JSX.Element {
  const router = useRouter();
  const { isHydrated, user } = useAuth();
  const allowed = isPlatformAdmin(user);

  useEffect(() => {
    if (!isHydrated) return;
    if (!allowed) {
      router.replace(DASHBOARD_ENTRY);
    }
  }, [isHydrated, allowed, router]);

  return (
    <MainLayout>
      {isHydrated && allowed ? children : <PlatformShell />}
    </MainLayout>
  );
}
