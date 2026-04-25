"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DASHBOARD_NAV_ITEMS } from "@/config/dashboard-navigation";
import { cn } from "@/utils/cn";
import { GraduationCap, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

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
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed ? "justify-center px-0" : "",
        active
          ? "bg-primary text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
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
  const displayName = user?.fullName ?? user?.name ?? "Učitel";

  const activeCount = DASHBOARD_NAV_ITEMS.filter((item) =>
    isActive(pathname ?? "", item.route),
  ).length;
  if (process.env.NODE_ENV === "development" && activeCount > 1) {
    console.warn("Sidebar active state error: multiple active items detected.");
  }

  return (
    <aside
      className={cn(
        "glass-panel hidden min-h-screen flex-col justify-between rounded-2xl p-4 transition-all duration-200 lg:flex",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="space-y-6">
        {/* Logo + toggle */}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <Link href="/app" className="flex items-center gap-2 text-slate-900">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">SkillStorm</p>
                <p className="text-xs text-slate-400">SkillStorm Suite</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <Link href="/app" title="Přehled">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700",
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
            className="flex w-full items-center justify-center rounded-lg py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Rozbalit postranní panel"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <nav className="space-y-1">
          {DASHBOARD_NAV_ITEMS.map((item) => (
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

      <div className={cn("rounded-xl border border-slate-100 bg-white p-3 shadow-soft", collapsed ? "p-2" : "")}>
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
              <p className="truncate text-xs font-semibold text-slate-900">{displayName}</p>
              {user?.organizationRole && (
                <Badge variant="success" className="w-fit capitalize text-xs">
                  {hasOrganization ? user.organizationRole.toLowerCase() : "bez školy"}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
