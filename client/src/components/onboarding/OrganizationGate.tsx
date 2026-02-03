"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const CREATE_ORG_PATH = "/onboarding/create-organization";
const DASHBOARD_ONBOARDING_PATH = "/dashboard/onboarding";
const DASHBOARD_PLATFORM_PATH = "/dashboard/platform";

/**
 * Organization gate – jediný zdroj pravdy: /auth/me (hasOrganization z memberships).
 * - Bez org: redirect na create-organization (kromě join flow a platform admin)
 * - S org na join stránce: redirect na dashboard (AcademicYearGate doplní redirect na academic-year)
 */
export function OrganizationGate({ children }: { children: ReactNode }): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasOrganization, isLoading } = useAuth();

  const isJoinOnboarding =
    pathname === DASHBOARD_ONBOARDING_PATH || pathname?.startsWith(`${DASHBOARD_ONBOARDING_PATH}/`);
  const isPlatformAdminRoute =
    pathname === DASHBOARD_PLATFORM_PATH || pathname?.startsWith(`${DASHBOARD_PLATFORM_PATH}/`);
  const isPlatformAdmin = user?.isPlatformAdmin === true;

  useEffect(() => {
    if (isLoading) return;
    if (hasOrganization) {
      if (isJoinOnboarding) {
        router.replace("/dashboard");
      }
      return;
    }
    if (isJoinOnboarding) return;
    if (isPlatformAdminRoute && isPlatformAdmin) return;
    router.replace(CREATE_ORG_PATH);
  }, [hasOrganization, isLoading, isJoinOnboarding, isPlatformAdminRoute, isPlatformAdmin, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji…" />
      </div>
    );
  }

  if (hasOrganization && isJoinOnboarding) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Přesměrovávám…" />
      </div>
    );
  }

  if (!hasOrganization && !isJoinOnboarding && !(isPlatformAdminRoute && isPlatformAdmin)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Přesměrovávám…" />
      </div>
    );
  }

  return children;
}
