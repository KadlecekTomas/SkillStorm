"use client";

import { Button } from "@/components/ui/button";
import { Bell, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV_ITEMS } from "@/config/dashboard-navigation";
import { PermissionGate } from "@/components/access/permission-gate";
import { PermissionKey } from "@/types";
import Link from "next/link";

function isActive(pathname: string, route: string): boolean {
  if (route === "/app") {
    return pathname === "/app";
  }
  return pathname === route || pathname.startsWith(route + "/");
}

export const AppHeader = (): React.JSX.Element => {
  const pathname = usePathname();
  const activeItem = DASHBOARD_NAV_ITEMS.find((item) =>
    isActive(pathname ?? "", item.route),
  );

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">
        {activeItem?.label ?? "Přehled"}
      </h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="rounded-lg h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>
        <PermissionGate
          permission={PermissionKey.CREATE_TEST}
          fallback={
            <Button className="rounded-lg h-8" variant="outline" disabled>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Omezeno</span>
            </Button>
          }
        >
          <Button className="rounded-lg h-8" asChild>
            <Link href="/app/tests">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Vytvořit</span>
            </Link>
          </Button>
        </PermissionGate>
      </div>
    </header>
  );
};
