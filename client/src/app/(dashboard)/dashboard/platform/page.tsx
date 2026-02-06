"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { DASHBOARD_ENTRY, isPlatformAdmin } from "@/utils/permissions";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const PLATFORM_ORGANIZATIONS = "/dashboard/platform/organizations";

/**
 * Platform dashboard entrypoint. Only SUPERADMIN / platform admin should reach here.
 * Auth invariant: logout is a hard boundary. No protected component may render after logout.
 */
export default function PlatformDashboardPage() {
  const router = useRouter();
  const { user, isLoading, isLoggingOut } = useAuth();
  if (isLoggingOut) return null;

  useEffect(() => {
    if (isLoading) return;
    if (isPlatformAdmin(user)) {
      router.replace(PLATFORM_ORGANIZATIONS);
    } else {
      router.replace(DASHBOARD_ENTRY);
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingSpinner label="Přesměrovávám…" />
    </div>
  );
}
