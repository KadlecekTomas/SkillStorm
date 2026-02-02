"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchActiveAcademicYear } from "@/lib/api/academic-years";
import { HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const ONBOARDING_PATH = "/onboarding/academic-year";

type AcademicYearGateProps = {
  children: ReactNode;
};

/**
 * Gate for OWNER users with organization: blocks dashboard access until
 * the organization has an active AcademicYear. Redirects to onboarding.
 * Non-OWNER users pass through unchanged.
 */
export const AcademicYearGate = ({ children }: AcademicYearGateProps): ReactNode => {
  const router = useRouter();
  const { user, org } = useAuth();
  const [status, setStatus] = useState<"checking" | "allowed" | "redirect">("checking");

  const isOwnerWithOrg =
    user?.organizationRole === "OWNER" &&
    org?.id &&
    user.organizationId === org.id;

  useEffect(() => {
    if (!isOwnerWithOrg) {
      setStatus("allowed");
      return;
    }

    let cancelled = false;
    fetchActiveAcademicYear()
      .then(() => {
        if (cancelled) return;
        setStatus("allowed");
      })
      .catch((err) => {
        if (cancelled) return;
        const isNoActiveYear =
          err instanceof HttpError &&
          (err.status === 409 ||
            (err.data as { meta?: { code?: string } })?.meta?.code === "NO_ACTIVE_ACADEMIC_YEAR" ||
            (err.data as { meta?: { code?: string } })?.meta?.code === "MULTIPLE_ACTIVE_ACADEMIC_YEARS");
        if (isNoActiveYear) {
          setStatus("redirect");
          router.replace(ONBOARDING_PATH);
        } else {
          setStatus("allowed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOwnerWithOrg, router]);

  if (!isOwnerWithOrg) {
    return children;
  }

  if (status === "checking" || status === "redirect") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji školní rok…" />
      </div>
    );
  }

  return children;
};
