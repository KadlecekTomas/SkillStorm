"use client";

import type { JSX, ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { isLogoutNavigationInProgress, storeReturnUrl } from "@/lib/auth-session";
import { canAccessPlatform } from "@/utils/permissions";
import { cn } from "@/utils/cn";

/**
 * Handbook group layout — interní dokumentace (Doctrine + Master Roadmap).
 *
 * Přístup: znovupoužívá existující platformní RBAC (`canAccessPlatform`:
 * SUPERADMIN / DEVOPS / SUPPORT / platform admin). Žádný nový auth systém.
 * Neoprávnění se přesměrují stejným způsobem jako u platform routes.
 *
 * Statické generování stránek tím není dotčeno: obsah (Markdown) se
 * prerenderuje na serveru; tento klientský guard řídí jen zobrazení/redirect.
 */

const NAV = [
  { href: "/handbook/doctrine", label: "Doctrine" },
  { href: "/handbook/master-roadmap", label: "Master Roadmap" },
] as const;

const FALLBACK = "/app";

function HandbookShellSkeleton(): JSX.Element {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function HandbookHeader(): JSX.Element {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/handbook"
          className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft">
            <BookOpen className="h-3.5 w-3.5 text-accent-deep" aria-hidden="true" />
          </span>
          Eduto Handbook
        </Link>
        <nav aria-label="Handbook" className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "bg-surface text-ink"
                    : "text-ink-muted hover:bg-surface hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default function HandbookGroupLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const { isAuthenticated, isHydrated, isLoggingOut, user } = useAuth();
  const allowed = canAccessPlatform(user);

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
    if (!allowed) {
      const timeoutId = window.setTimeout(() => {
        router.replace(FALLBACK);
      }, 50);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [isAuthenticated, isHydrated, isLoggingOut, user, allowed, router]);

  if (!isHydrated) return <HandbookShellSkeleton />;
  if (isLogoutNavigationInProgress()) return <></>;
  if (isLoggingOut || !isAuthenticated || !user) return <></>;
  if (!allowed) return <HandbookShellSkeleton />;

  return (
    <div className="min-h-screen bg-canvas">
      <HandbookHeader />
      <main>{children}</main>
    </div>
  );
}
