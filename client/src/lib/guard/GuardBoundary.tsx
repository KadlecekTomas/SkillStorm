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
  if (isLoggingOut) return null;

  const readyMarker = (
    <div
      data-testid="profile-ready"
      aria-hidden="true"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    />
  );

  useEffect(() => {
    // ⛔ nikdy neredirectuj během bootstrapu
    if (guard.isLoading) return;
    if (authStatus === "authenticating" || authStatus === "refreshing") return;

    // ✅ pokud je přístup povolen, nic nedělej
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

    // ❌ nepřihlášen → login
    if (!user && authStatus === "unauthenticated") {
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

    // ⛔ přihlášen, ale nemá oprávnění
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
