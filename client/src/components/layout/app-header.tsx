"use client";

import { Button } from "@/components/ui/button";
import { Bell, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  DASHBOARD_NAV_ITEMS,
  PARENT_NAV_ITEMS,
} from "@/config/dashboard-navigation";
import { PermissionGate } from "@/components/access/permission-gate";
import { PermissionKey } from "@/types";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

function isActive(pathname: string, route: string): boolean {
  if (route === "/app") {
    return pathname === "/app";
  }
  return pathname === route || pathname.startsWith(route + "/");
}

export const AppHeader = (): React.JSX.Element => {
  const pathname = usePathname();
  const { user } = useAuth();
  // Guardian Etapa B: rodičovský kontext má vlastní navigaci i titulky.
  const navItems =
    user?.organizationRole === "PARENT" ? PARENT_NAV_ITEMS : DASHBOARD_NAV_ITEMS;
  const activeItem = navItems.find((item) =>
    isActive(pathname ?? "", item.route),
  );

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-bold text-ink">
        {activeItem?.label ?? "Přehled"}
      </h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="rounded-lg h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>
        {/* Bez oprávnění tlačítko schováme — zašedlé „Omezeno" jen mate žáky */}
        <PermissionGate permission={PermissionKey.CREATE_TEST} fallback={null}>
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
