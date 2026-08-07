"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const CREATE_ORG_PATH = "/onboarding/create-organization";
const ACADEMIC_YEAR_PATH = "/onboarding/academic-year";
const PENDING_ORG_PATH = "/onboarding/pending";
const SETUP_PATH = "/onboarding/setup";
const ORGANIZATION_SUSPENDED_PATH = "/organization-suspended";

/**
 * Onboarding route guard.
 *
 * Domain rule: organization.status is the single source of truth. Readiness applies only when status === ACTIVE.
 * - SUSPENDED: must NEVER see onboarding; redirect to /organization-suspended immediately.
 * - PENDING: canonical route /onboarding/pending only (approval waiting).
 * - ACTIVE: onboarding routes invalid; redirect to dashboard.
 *
 * Routing rules:
 * - SUSPENDED → /organization-suspended (hard block; no onboarding, no repair).
 * - PENDING SCHOOL → /onboarding/pending only.
 * - Terminal state (readiness === READY): redirect away from onboarding.
 * - Repair/init: handled on /app/classrooms, not here.
 */
export function OnboardingRouteGuard({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { user, org, orgState, isLoading, hasOrganization, activeRole } = useAuth();
  const [ready, setReady] = useState(false);

  const effectiveRole = activeRole ?? user?.organizationRole ?? null;
  const isOwner = effectiveRole === "OWNER";
  const orgType = org?.type;
  const isSchool = orgType === "SCHOOL";

  useEffect(() => {
    if (isLoading) return;

    const path = pathname ?? "";

    if (orgState === "SUSPENDED" || org?.status === "SUSPENDED") {
      if (path !== ORGANIZATION_SUSPENDED_PATH) {
        router.replace(ORGANIZATION_SUSPENDED_PATH);
      }
      return;
    }

    if (!hasOrganization) {
      if (path !== CREATE_ORG_PATH) {
        router.replace(CREATE_ORG_PATH);
        return;
      }
      setReady(true);
      return;
    }

    if (isSchool && orgState === "PENDING") {
      if (path !== PENDING_ORG_PATH) {
        router.replace(PENDING_ORG_PATH);
        return;
      }
      setReady(true);
      return;
    }

    if (path === CREATE_ORG_PATH) {
      router.replace(ACADEMIC_YEAR_PATH);
      return;
    }

    if (path === ACADEMIC_YEAR_PATH) {
      if (!isOwner) {
        router.replace("/app");
        return;
      }
      setReady(true);
      return;
    }

    if (path === PENDING_ORG_PATH && !(isSchool && orgState === "PENDING")) {
      router.replace("/app");
      return;
    }

    if (path === SETUP_PATH) {
      if (org?.readiness === "READY") {
        router.replace("/app");
        return;
      }
      setReady(true);
      return;
    }

    setReady(true);
  }, [
    pathname,
    hasOrganization,
    isOwner,
    isLoading,
    orgState,
    isSchool,
    org?.status,
    org?.readiness,
    router,
  ]);

  if (isLoading || !ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji…" />
      </div>
    );
  }

  return children;
}
