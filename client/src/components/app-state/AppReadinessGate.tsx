"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/app-state/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { AppStateScreens } from "./AppStateScreens";

const PLATFORM_PATH = "/dashboard/platform";

type AppReadinessGateProps = {
  children: ReactNode;
};

/**
 * Single authoritative gate: domain modules render ONLY when AppState === READY.
 * Auth invariant: logout is a hard boundary. No protected component may render after logout.
 * Platform admin routes are allowed through so admins can manage orgs regardless of org status.
 */
export function AppReadinessGate({
  children,
}: AppReadinessGateProps): React.JSX.Element | null {
  const pathname = usePathname();
  const { state, refresh } = useAppState();
  const { context, isLoggingOut } = useAuth();
  if (isLoggingOut) return null;

  const isPlatformAdminRoute = pathname?.startsWith(PLATFORM_PATH) ?? false;
  const isPlatformContext = context?.mode === "platform";

  if (isPlatformAdminRoute && isPlatformContext) {
    return <>{children}</>;
  }

  if (state.code !== "READY") {
    return <AppStateScreens state={state} onRetry={refresh} />;
  }

  return <>{children}</>;
}
