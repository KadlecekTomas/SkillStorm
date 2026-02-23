"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/app-state/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { AppStateScreens } from "./AppStateScreens";
import {
  BACKEND_STATE_CODES,
  isRepairStateFromAppState,
} from "@/lib/app-state/app-state";

const PLATFORM_PATH = "/app/platform";
const CLASSROOMS_PATH = "/app/classrooms";

type AppReadinessGateProps = {
  children: ReactNode;
};

/**
 * Single authoritative gate: domain modules render ONLY when AppState === READY.
 * organization.status is the SINGLE source of truth. Readiness gates apply ONLY when status === ACTIVE.
 *
 * - ORG_PENDING → PendingOrganizationOnboardingScreen (approval waiting).
 * - ORG_SUSPENDED → Suspended screen ONLY; no children, no retry, no onboarding/repair CTAs.
 * - ACTIVE + NOT_READY (NO_CLASS_SECTION / CLASS_NOT_IN_ACTIVE_YEAR): allow /app/classrooms only.
 * - READY: render children.
 *
 * Exceptions: platform admin routes (when context is platform).
 */
export function AppReadinessGate({
  children,
}: AppReadinessGateProps): React.JSX.Element | null {
  const pathname = usePathname();
  const { state, refresh } = useAppState();
  const { context, org, orgState, isLoggingOut } = useAuth();
  if (isLoggingOut) return null;

  const isPlatformAdminRoute = pathname?.startsWith(PLATFORM_PATH) ?? false;
  const isPlatformContext = context?.mode === "platform";

  if (isPlatformAdminRoute && isPlatformContext) {
    return <>{children}</>;
  }

  const isClassroomsPath =
    pathname === CLASSROOMS_PATH || pathname?.startsWith(`${CLASSROOMS_PATH}/`);
  const isRepairState = isRepairStateFromAppState(
    state.code,
    state.errorCode ?? null,
    org?.bootstrap ?? null,
  );

  const isInitOrgState =
    state.code === "ORG_NOT_READY" &&
    state.errorCode === BACKEND_STATE_CODES.NO_CLASS_SECTION &&
    (orgState === "ACTIVE" || org?.status === "ACTIVE");

  // Canonical repair/setup surface in ACTIVE but NOT_READY states:
  // - Repair state (CLASS_NOT_IN_ACTIVE_YEAR)
  // - Init state (NO_CLASS_SECTION with ACTIVE org)
  // In both cases, /app/classrooms must always render and must never
  // be redirected away based on readiness alone.
  if (isClassroomsPath && (isRepairState || isInitOrgState)) {
    return <>{children}</>;
  }

  if (state.code !== "READY") {
    return (
      <AppStateScreens
        state={state}
        {...(state.code !== "ORG_SUSPENDED" ? { onRetry: refresh } : {})}
      />
    );
  }

  return <>{children}</>;
}
