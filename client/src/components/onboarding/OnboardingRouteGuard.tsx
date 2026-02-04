"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const CREATE_ORG_PATH = "/onboarding/create-organization";
const ACADEMIC_YEAR_PATH = "/onboarding/academic-year";
const PENDING_ORG_PATH = "/onboarding/pending";

/**
 * Route guard pro onboarding flow:
 * - create-organization: pouze pro uživatele BEZ organizace. Pokud má org → stavové routování podle orgState.
 * - pending: pouze pro SCHOOL organizace ve stavu PENDING.
 * - academic-year: pouze pro OWNER s ACTIVE/HAS_ORG organizací. PENDING SCHOOL je přesměrována na /onboarding/pending.
 *
 * Klient nikdy nenutí PENDING SCHOOL organizaci k vytvoření školního roku.
 */
export function OnboardingRouteGuard({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { user, org, orgState, isLoading } = useAuth();
  const [ready, setReady] = useState(false);

  const hasOrganization = Boolean(org?.id);
  const isOwner = user?.organizationRole === "OWNER";
  const orgType = org?.type;
  const isSchool = orgType === "SCHOOL";

  useEffect(() => {
    if (isLoading) return;

    const path = pathname ?? "";

    // Uživatel bez organizace – smí pouze na create-organization
    if (!hasOrganization) {
      if (path !== CREATE_ORG_PATH) {
        router.replace(CREATE_ORG_PATH);
        return;
      }
      setReady(true);
      return;
    }

    // SCHOOL organizace ve stavu PENDING – vždy na /onboarding/pending
    if (isSchool && orgState === "PENDING") {
      if (path !== PENDING_ORG_PATH) {
        router.replace(PENDING_ORG_PATH);
        return;
      }
      setReady(true);
      return;
    }

    // create-organization: pokud už má organizaci, přepni na další krok
    if (path === CREATE_ORG_PATH) {
      router.replace(ACADEMIC_YEAR_PATH);
      return;
    }

    // academic-year: pouze pro OWNER s organizací, ne pro členy
    if (path === ACADEMIC_YEAR_PATH) {
      if (!isOwner) {
        router.replace("/dashboard");
        return;
      }
      setReady(true);
      return;
    }

    // pending stránka pro jiné než PENDING SCHOOL nedává smysl → na dashboard
    if (path === PENDING_ORG_PATH && !(isSchool && orgState === "PENDING")) {
      router.replace("/dashboard");
      return;
    }

    setReady(true);
  }, [pathname, hasOrganization, isOwner, isLoading, orgState, isSchool, router]);

  if (isLoading || !ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji…" />
      </div>
    );
  }

  return children;
}
