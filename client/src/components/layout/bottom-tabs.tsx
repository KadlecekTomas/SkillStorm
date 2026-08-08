"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { getDashboardNavItems } from "@/config/dashboard-navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/utils/cn";

function isActive(pathname: string, route: string): boolean {
  if (route === "/app") {
    return pathname === "/app";
  }
  return pathname === route || pathname.startsWith(route + "/");
}

/**
 * Mobilní navigace drží maximálně pět položek. Denní funkce jsou přímo
 * dostupné, méně časté cíle jsou pod „Více“, aby se text nemačkal do úzkých
 * sloupců a spodní lišta zůstala čitelná i na 360 px.
 */
export const BottomTabs = (): React.JSX.Element => {
  const pathname = usePathname();
  const { user, activeRole } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const effectiveRole = activeRole ?? user?.organizationRole ?? null;
  const navItems = getDashboardNavItems(effectiveRole).filter(
    (item) => item.route !== "/app/people",
  );

  const useOverflow = navItems.length > 5;
  const primaryItems = useOverflow ? navItems.slice(0, 4) : navItems;
  const overflowItems = useOverflow ? navItems.slice(4) : [];
  const moreActive = overflowItems.some((item) =>
    isActive(pathname ?? "", item.route),
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {moreOpen && overflowItems.length > 0 && (
        <div className="absolute inset-x-3 bottom-[calc(100%+8px)] mx-auto max-w-sm rounded-2xl border border-line bg-canvas p-2 shadow-xl">
          <div className="grid grid-cols-2 gap-1">
            {overflowItems.map((item) => {
              const active = isActive(pathname ?? "", item.route);
              return (
                <Link
                  key={item.route}
                  href={item.route}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
                    active
                      ? "bg-accent-soft text-accent-deep"
                      : "text-ink-muted hover:bg-surface",
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex min-h-12 items-stretch">
        {primaryItems.map((item) => {
          const active = isActive(pathname ?? "", item.route);
          return (
            <Link
              key={item.route}
              href={item.route}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium",
                active ? "text-accent-deep" : "text-ink-dim",
              )}
            >
              {item.icon}
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}

        {overflowItems.length > 0 && (
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-label="Další navigace"
            onClick={() => setMoreOpen((value) => !value)}
            className={cn(
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium",
              moreOpen || moreActive ? "text-accent-deep" : "text-ink-dim",
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>Více</span>
          </button>
        )}
      </div>
    </nav>
  );
};
