"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const CREATE_ORG_PATH = "/onboarding/create-organization";
const DASHBOARD_ONBOARDING_PATH = "/dashboard/onboarding";

/**
 * Redirects users without organization to /onboarding/create-organization.
 * Exception: /dashboard/onboarding (join flow) is allowed without org.
 */
export function OrganizationGate({ children }: { children: ReactNode }): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { hasOrganization, isLoading } = useAuth();

  const isJoinOnboarding =
    pathname === DASHBOARD_ONBOARDING_PATH || pathname?.startsWith(`${DASHBOARD_ONBOARDING_PATH}/`);

  useEffect(() => {
    if (isLoading) return;
    if (hasOrganization) return;
    if (isJoinOnboarding) return;
    router.replace(CREATE_ORG_PATH);
  }, [hasOrganization, isLoading, isJoinOnboarding, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji…" />
      </div>
    );
  }

  if (!hasOrganization && !isJoinOnboarding) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Přesměrovávám…" />
      </div>
    );
  }

  return children;
}
