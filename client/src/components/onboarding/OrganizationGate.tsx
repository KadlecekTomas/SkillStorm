"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const CREATE_ORG_PATH = "/onboarding/create-organization";
const SETUP_PATH = "/onboarding/setup";
const DASHBOARD_CLASSROOMS_PATH = "/dashboard/classrooms";
const DASHBOARD_ONBOARDING_PATH = "/dashboard/onboarding";
const DASHBOARD_PLATFORM_PATH = "/dashboard/platform";

/**
 * Organization gate – jediný zdroj pravdy: /auth/me (hasOrganization z memberships).
 * Auth invariant: logout is a hard boundary. No protected component may render after logout.
 * - LOGGING_OUT: return null first (no hooks, no dashboard logic).
 * - Bez org: redirect na create-organization (kromě join flow a platform admin)
 * - ACTIVE + NOT_READY: redirect na /onboarding/setup (žádný fetch dashboard dat)
 * - S org na join stránce: redirect na dashboard (AppReadinessGate zobrazí stavovou obrazovku nebo obsah)
 * - Platform routes: povoleny pouze pro isPlatformAdmin(user) (SUPERADMIN nebo isPlatformAdmin).
 */
export function OrganizationGate({ children }: { children: ReactNode }): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { context, org, hasOrganization, isLoading, isLoggingOut } = useAuth();

  if (isLoggingOut) return null;

  const isJoinOnboarding =
    pathname === DASHBOARD_ONBOARDING_PATH || pathname?.startsWith(`${DASHBOARD_ONBOARDING_PATH}/`);
  const isPlatformAdminRoute =
    pathname === DASHBOARD_PLATFORM_PATH || pathname?.startsWith(`${DASHBOARD_PLATFORM_PATH}/`);
  const mode = context?.mode ?? "personal";
  const activeNotReady =
    mode === "organization" &&
    org?.status === "ACTIVE" &&
    org?.readiness === "NOT_READY";
  const isClassroomsPath =
    pathname === DASHBOARD_CLASSROOMS_PATH ||
    pathname?.startsWith(`${DASHBOARD_CLASSROOMS_PATH}/`);
  const redirectToSetup = activeNotReady && !isClassroomsPath;

  useEffect(() => {
    if (isLoading) return;
    if (redirectToSetup) {
      router.replace(SETUP_PATH);
      return;
    }
    if (mode === "organization") {
      if (isJoinOnboarding) {
        router.replace("/dashboard");
      }
      return;
    }
    if (isJoinOnboarding) return;
    if (isPlatformAdminRoute && mode === "platform") return;
    router.replace(CREATE_ORG_PATH);
  }, [mode, redirectToSetup, isLoading, isJoinOnboarding, isPlatformAdminRoute, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji…" />
      </div>
    );
  }

  if (redirectToSetup) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Přesměrovávám…" />
      </div>
    );
  }

  if (mode === "organization" && isJoinOnboarding) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Přesměrovávám…" />
      </div>
    );
  }

  // Personal mode: always redirect to create-organization outside join onboarding.
  // Platform access is handled separately in the effect; this branch must only care about "personal".
  if (mode === "personal" && !isJoinOnboarding) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Přesměrovávám…" />
      </div>
    );
  }

  return children;
}
