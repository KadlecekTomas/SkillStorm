"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGuard, type GuardOptions } from "@/lib/guard/useGuard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AccessDenied } from "@/components/access/access-denied";
import { NoOrganizationScreen } from "@/components/onboarding/NoOrganizationScreen";
import { reportForbiddenAccess } from "@/utils/rbac-telemetry";
import { AUTH_DEBUG } from "@/utils/env";
import { useAuth } from "@/hooks/use-auth";
import { storeReturnUrl } from "@/lib/auth-session";

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
}: GuardBoundaryProps): ReactNode => {
  const { user, authStatus, isLoggingOut } = useAuth();
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
    if (guard.isLoading) return;
    if (authStatus === "authenticating" || authStatus === "refreshing") return;

    if (guard.allowed) return;

    if (AUTH_DEBUG) {
      console.log(
        "%c[AUTH][GUARD]",
        "color:#f97316;font-weight:600",
        {
          reason: guard.reason,
          authStatus,
          userId: user?.id ?? null,
        },
      );
    }

    if (!user && authStatus === "unauthenticated") {
      if (typeof window !== "undefined") {
        storeReturnUrl(window.location.pathname + window.location.search);
      }
      if (AUTH_DEBUG) {
        console.log(
          "%c[AUTH][REDIRECT]",
          "color:#dc2626;font-weight:600",
          "/login",
        );
      }
      router.replace("/login");
      return;
    }

    if (guard.reason === "FORBIDDEN") {
      reportForbiddenAccess({
        route: typeof window !== "undefined" ? window.location.pathname : "",
        message: "GuardBoundary blocked access",
        ...(options.requirePerms?.[0]
          ? { permissionKey: options.requirePerms[0] }
          : {}),
      });
    }
  }, [
    guard.allowed,
    guard.isLoading,
    guard.reason,
    authStatus,
    user,
    options.requirePerms,
    options.requireRoles,
    options.requireSchoolWorkspace,
    router,
  ]);

  if (isLoggingOut) return null;

  if (guard.isLoading) {
    return (
      loadingFallback ?? (
        <div className="py-12">
          <LoadingSpinner label="Kontroluji oprávnění…" />
        </div>
      )
    );
  }

  if (!guard.allowed && guard.reason === "NO_ORGANIZATION") {
    return (
      <>
        {readyMarker}
        <NoOrganizationScreen />
      </>
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
