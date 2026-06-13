"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const CREATE_ORG_PATH = "/onboarding/create-organization";
const DASHBOARD_CLASSROOMS_PATH = "/app/classrooms";
const DASHBOARD_ONBOARDING_PATH = "/app/onboarding";
const DASHBOARD_PLATFORM_PATH = "/app/platform";

/**
 * Organization gate – route-level enforcement. organization.status is the SINGLE source of truth.
 * Readiness is evaluated ONLY when status === ACTIVE.
 *
 * - status === PENDING   → redirect to /onboarding/pending. No /app/*.
 * - status === SUSPENDED → redirect to /organization-suspended. No /app/*, no /onboarding/*.
 * - status === ACTIVE    → allow /app/*; onboarding routes invalid. NOT_READY → repair on /app/classrooms.
 *
 * Violations (e.g. treating SUSPENDED as PENDING, redirecting SUSPENDED into onboarding) are SEVERE DOMAIN BUGS.
 */
export function OrganizationGate({ children }: { children: ReactNode }): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { context, org, isLoading, isLoggingOut } = useAuth();

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
  const redirectToClassrooms = activeNotReady && !isClassroomsPath;

  useEffect(() => {
    if (isLoggingOut) return;
    if (isLoading) return;
    if (mode === "organization" && org?.status === "SUSPENDED") {
      if (pathname !== "/organization-suspended") {
        router.replace("/organization-suspended");
      }
      return;
    }
    if (mode === "organization" && org?.status === "PENDING") {
      if (!pathname?.startsWith("/onboarding")) {
        router.replace("/onboarding/pending");
        return;
      }
    }
    if (redirectToClassrooms) {
      router.replace(DASHBOARD_CLASSROOMS_PATH);
      return;
    }
    if (mode === "organization") {
      if (isJoinOnboarding) {
        router.replace("/app");
      }
      return;
    }
    if (isJoinOnboarding) return;
    if (isPlatformAdminRoute && mode === "platform") return;
    router.replace(CREATE_ORG_PATH);
  }, [pathname, org?.status, mode, redirectToClassrooms, isLoading, isJoinOnboarding, isPlatformAdminRoute, isLoggingOut, router]);

  if (isLoggingOut) return null;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji…" />
      </div>
    );
  }

  if (redirectToClassrooms) {
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
