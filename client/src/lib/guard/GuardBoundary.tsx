"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGuard, type GuardOptions } from "@/lib/guard/useGuard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AccessDenied } from "@/components/access/access-denied";
import { reportForbiddenAccess } from "@/utils/rbac-telemetry";

type GuardBoundaryProps = GuardOptions & {
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
};

export const GuardBoundary = ({
  children,
  fallback,
  loadingFallback,
  ...options
}: GuardBoundaryProps) => {
  const guard = useGuard(options);
  const router = useRouter();

  const readyMarker = (
    <div
      data-testid="profile-ready"
      aria-hidden="true"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    />
  );

  useEffect(() => {
    if (guard.allowed || guard.isLoading) return;
    if (guard.reason === "UNAUTHENTICATED") {
      router.replace("/login");
    } else if (guard.reason === "NO_ORGANIZATION") {
      router.replace("/select-organization");
    } else if (guard.reason === "FORBIDDEN") {
      reportForbiddenAccess({
        route: typeof window !== "undefined" ? window.location.pathname : "",
        message: "GuardBoundary blocked access",
        ...(options.requirePerms?.[0]
          ? { permissionKey: options.requirePerms[0] }
          : {}),
      });
    }
  }, [guard.allowed, guard.isLoading, guard.reason, options.requirePerms, router]);

  if (guard.isLoading) {
    return (
      loadingFallback ?? (
        <div className="py-12">
          <LoadingSpinner label="Kontroluji oprávnění…" />
        </div>
      )
    );
  }

  if (!guard.allowed && guard.reason === "FORBIDDEN") {
    return (
      <>
        {readyMarker}
        {fallback ?? <AccessDenied />}
      </>
    );
  }

  return (
    <>
      {readyMarker}
      {children}
    </>
  );
};
