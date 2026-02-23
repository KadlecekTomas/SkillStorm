"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { isPlatformAdmin } from "@/utils/permissions";
import { Skeleton } from "@/components/ui/skeleton";

const PLATFORM_ORGANIZATIONS = "/app/platform/organizations";

/**
 * Platform dashboard entrypoint. Only SUPERADMIN / platform admin should reach here.
 * Auth invariant: logout is a hard boundary. No protected component may render after logout.
 */
export default function PlatformDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (isPlatformAdmin(user)) {
      router.replace(PLATFORM_ORGANIZATIONS);
    }
  }, [user, router]);

  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-80" />
    </div>
  );
}
