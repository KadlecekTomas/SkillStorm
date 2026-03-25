"use client";

import type { JSX, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PlatformMainLayout } from "@/components/layout/platform-main-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { isLogoutNavigationInProgress, storeReturnUrl } from "@/lib/auth-session";
import { canAccessPlatform } from "@/utils/permissions";

const PLATFORM_FORBIDDEN = "/app/platform/forbidden";
const PLATFORM_FALLBACK = "/app";

/**
 * Platform group layout.
 *
 * Owns the complete visual shell for /app/platform/*.
 * No school gates (OrganizationGate, BootstrapGate, AppReadinessGate) run here.
 *
 * Access guard:
 *  - Not SUPERADMIN → redirect to /app/platform/forbidden (explicit 403 page)
 *  - On the forbidden page itself: render children directly so the page can
 *    display its own full-screen dark layout without the PlatformMainLayout shell.
 *    This also prevents an infinite redirect loop.
 *
 * Dev-only invariant: any fetch to school-context URLs (academic, classroom, enrollment)
 * from within a platform route logs a console warning so cross-context leaks are caught.
 */

const SCHOOL_CONTEXT_PATTERNS = ["academic", "classroom", "enrollment"] as const;

function useSchoolContextLeakDetector(): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>): ReturnType<typeof fetch> => {
      const url = args[0]?.toString() ?? "";
      for (const pattern of SCHOOL_CONTEXT_PATTERNS) {
        if (url.includes(pattern)) {
          console.warn(
            `[Platform] ⚠ SCHOOL CONTEXT LEAK DETECTED — fetch to "${url}" contains "${pattern}". ` +
              "Platform routes must not call school-scoped APIs.",
          );
          break;
        }
      }
      return originalFetch(...args);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
}

const PlatformShell = (): JSX.Element => (
  <div className="flex min-h-screen bg-gray-50">
    <div className="hidden w-60 border-r border-gray-200 bg-white lg:block" />
    <div className="flex-1 space-y-6 p-6">
      <Skeleton className="h-5 w-40 bg-gray-200" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`shell-card-${i}`} className="h-28 bg-gray-200" />
        ))}
      </div>
      <Skeleton className="h-64 bg-gray-200" />
    </div>
  </div>
);

export default function PlatformGroupLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isHydrated, isLoggingOut, user } = useAuth();
  const allowed = user != null && canAccessPlatform(user);
  const isForbiddenPage = pathname === PLATFORM_FORBIDDEN;

  useSchoolContextLeakDetector();

  useEffect(() => {
    if (!isHydrated) return;
    if (isLoggingOut) return;
    if (isLogoutNavigationInProgress()) return;
    if (!isAuthenticated || !user) {
      if (typeof window !== "undefined") {
        storeReturnUrl(window.location.pathname + window.location.search);
      }
      router.replace("/login");
      return;
    }
    // Don't redirect when already on the forbidden page — that would create an infinite loop.
    if (!allowed && !isForbiddenPage) {
      const timeoutId = window.setTimeout(() => {
        router.replace(PLATFORM_FALLBACK);
      }, 50);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [isAuthenticated, isHydrated, isLoggingOut, user, allowed, isForbiddenPage, router]);

  // Hydrating: show skeleton to avoid flash of wrong content.
  if (!isHydrated) return <PlatformShell />;
  if (isLogoutNavigationInProgress()) return <></>;
  if (isLoggingOut || !isAuthenticated || !user) return <></>;

  // Forbidden page: render its own full-screen layout without the sidebar shell.
  // Non-forbidden unauthorized access: skeleton while the redirect fires.
  if (!allowed) return isForbiddenPage ? <>{children}</> : <PlatformShell />;

  return <PlatformMainLayout>{children}</PlatformMainLayout>;
}
