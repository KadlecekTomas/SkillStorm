"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getNavItemsForRole } from "@/config/dashboard-navigation";
import { cn } from "@/utils/cn";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { PartakEmblem } from "@/components/partak";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { roleLabel } from "@/lib/labels";

function isActive(pathname: string, route: string): boolean {
  if (route === "/app") {
    return pathname === "/app";
  }
  return pathname === route || pathname.startsWith(route + "/");
}

type SidebarItemProps = {
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
  collapsed: boolean;
};

function SidebarItem({ label, icon, href, active, collapsed }: SidebarItemProps): React.JSX.Element {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] font-semibold transition-colors",
        collapsed ? "justify-center px-0" : "",
        active
          ? "bg-accent-soft text-accent-deep"
          : "text-ink-muted hover:bg-surface hover:text-ink",
      )}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export const Sidebar = (): React.JSX.Element => {
  const pathname = usePathname();
  const { user, hasOrganization } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const displayName = user?.fullName ?? user?.name ?? "Uživatel";
  const navItems = getNavItemsForRole(user?.organizationRole);

  const activeCount = navItems.filter((item) =>
    isActive(pathname ?? "", item.route),
  ).length;
  if (process.env.NODE_ENV === "development" && activeCount > 1) {
    console.warn("Sidebar active state error: multiple active items detected.");
  }

  return (
    <aside
      className={cn(
        "hidden min-h-screen shrink-0 flex-col justify-between border-r border-line bg-canvas px-3 py-6 transition-all duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="space-y-6">
        {/* Logo + toggle */}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-1")}>
          {!collapsed && (
            <Link href="/app" className="flex items-center gap-2.5 text-ink">
              <PartakEmblem size={30} />
              <span className="text-lg font-extrabold tracking-[-.01em]">SkillStorm</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/app" title="Přehled">
              <PartakEmblem size={30} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg text-ink-dim hover:bg-surface hover:text-ink",
              collapsed ? "hidden" : "",
            )}
            aria-label={collapsed ? "Rozbalit postranní panel" : "Sbalit postranní panel"}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex w-full items-center justify-center rounded-lg py-1 text-ink-dim hover:bg-surface hover:text-ink"
            aria-label="Rozbalit postranní panel"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <SidebarItem
              key={item.route}
              label={item.label}
              icon={item.icon}
              href={item.route}
              active={isActive(pathname ?? "", item.route)}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </div>

      <div className={cn("rounded-xl border border-line bg-canvas-alt p-3", collapsed ? "p-2" : "")}>
        <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}>
          <Avatar className="h-9 w-9 shrink-0">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            ) : (
              <AvatarFallback className="text-xs">
                {displayName
                  .split(" ")
                  .map((n) => n[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() ?? "SS"}
              </AvatarFallback>
            )}
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-xs font-bold text-ink">{displayName}</p>
              {user?.organizationRole && (
                <Badge variant="secondary" className="w-fit text-xs">
                  {hasOrganization ? roleLabel(user.organizationRole) : "Bez školy"}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
