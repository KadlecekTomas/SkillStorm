"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { getNavItemsForRole } from "@/config/dashboard-navigation";
import { PermissionGate } from "@/components/access/permission-gate";
import { PermissionKey } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

function isActive(pathname: string, route: string): boolean {
  if (route === "/app") {
    return pathname === "/app";
  }
  return pathname === route || pathname.startsWith(route + "/");
}

export const AppHeader = (): React.JSX.Element => {
  const pathname = usePathname();
  const { user } = useAuth();
  const activeItem = getNavItemsForRole(user?.organizationRole).find((item) =>
    isActive(pathname ?? "", item.route),
  );

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-bold text-ink">
        {activeItem?.label ?? "Přehled"}
      </h1>
      <div className="flex items-center gap-2">
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
