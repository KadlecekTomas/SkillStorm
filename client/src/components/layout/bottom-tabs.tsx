"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV_ITEMS } from "@/config/dashboard-navigation";
import { cn } from "@/utils/cn";

function isActive(pathname: string, route: string): boolean {
  if (route === "/app") {
    return pathname === "/app";
  }
  return pathname === route || pathname.startsWith(route + "/");
}

/**
 * Mobilní spodní navigace (design reference: .bottomtabs) — zobrazuje se
 * pod 768 px místo nav railu. Obsah stránky musí mít odpovídající
 * padding-bottom (řeší MainLayout).
 */
export const BottomTabs = (): React.JSX.Element => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {DASHBOARD_NAV_ITEMS.map((item) => {
        const active = isActive(pathname ?? "", item.route);
        return (
          <Link
            key={item.route}
            href={item.route}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 px-1 pb-2.5 pt-2 text-[11px] font-bold",
              active ? "text-accent-deep" : "text-ink-dim",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};
