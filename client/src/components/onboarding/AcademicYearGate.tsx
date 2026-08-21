"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentAcademicYear } from "@/lib/api/academic-years";
import { HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const ONBOARDING_PATH = "/onboarding/academic-year";
const PENDING_ORG_PATH = "/onboarding/pending";

type AcademicYearGateProps = {
  children: ReactNode;
};

/**
 * Gate pro OWNER uživatele s organizací:
 * - SCHOOL + PENDING: redirect na /onboarding/pending, žádné volání academic-year API.
 * - ACTIVE org bez aktivního školního roku: redirect na onboarding/academic-year.
 * - Ostatní role / stavy: průchod beze změny.
 */
export const AcademicYearGate = ({ children }: AcademicYearGateProps): ReactNode => {
  const router = useRouter();
  const { user, org, orgState, activeRole } = useAuth();
  const [status, setStatus] = useState<"checking" | "allowed" | "redirect">("checking");

  const effectiveRole = activeRole ?? user?.organizationRole ?? null;
  const isOwnerWithOrg =
    effectiveRole === "OWNER" &&
    org?.id &&
    user?.organizationId === org.id;

  const isSchool = org?.type === "SCHOOL";

  useEffect(() => {
    if (!isOwnerWithOrg) {
      setStatus("allowed");
      return;
    }

    if (isSchool && orgState === "PENDING") {
      setStatus("redirect");
      router.replace(PENDING_ORG_PATH);
      return;
    }

    if (orgState !== "ACTIVE") {
      setStatus("allowed");
      return;
    }

    let cancelled = false;
    fetchCurrentAcademicYear()
      .then(() => {
        if (cancelled) return;
        setStatus("allowed");
      })
      .catch((err) => {
        if (cancelled) return;
        const data = err instanceof HttpError
          ? (err.data as { code?: string; meta?: { code?: string } } | undefined)
          : undefined;
        const code = data?.code ?? data?.meta?.code ?? null;

        if (
          err instanceof HttpError &&
          (code === "ORG_PENDING" || code === "ORG_NOT_READY")
        ) {
          setStatus("allowed");
          return;
        }

        const isNoCurrentYear =
          err instanceof HttpError &&
          (err.status === 409 ||
            code === "NO_CURRENT_ACADEMIC_YEAR" ||
            code === "MULTIPLE_CURRENT_ACADEMIC_YEARS");

        if (isNoCurrentYear) {
          setStatus("redirect");
          router.replace(ONBOARDING_PATH);
        } else {
          setStatus("allowed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOwnerWithOrg, isSchool, orgState, router]);

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
