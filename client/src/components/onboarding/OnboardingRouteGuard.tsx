"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const CREATE_ORG_PATH = "/onboarding/create-organization";
const ACADEMIC_YEAR_PATH = "/onboarding/academic-year";

/**
 * Route guard for onboarding flow:
 * - create-organization: only for users WITHOUT org. If has org → academic-year
 * - academic-year: only for OWNER WITH org. If no org → create-organization. If not OWNER → dashboard
 */
export function OnboardingRouteGuard({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { user, org, isLoading } = useAuth();
  const [ready, setReady] = useState(false);

  const hasOrganization = Boolean(org?.id);
  const isOwner = user?.organizationRole === "OWNER";

  useEffect(() => {
    if (isLoading) return;

    const path = pathname ?? "";

    if (path === CREATE_ORG_PATH) {
      if (hasOrganization) {
        router.replace(ACADEMIC_YEAR_PATH);
        return;
      }
    }

    if (path === ACADEMIC_YEAR_PATH) {
      if (!hasOrganization) {
        router.replace(CREATE_ORG_PATH);
        return;
      }
      if (!isOwner) {
        router.replace("/dashboard");
        return;
      }
    }

    setReady(true);
  }, [pathname, hasOrganization, isOwner, isLoading, router]);

  if (isLoading || !ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji…" />
      </div>
    );
  }

  return children;
}
