"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { DASHBOARD_NAV_ITEMS } from "@/config/dashboard-navigation";
import { cn } from "@/utils/cn";
import { GraduationCap } from "lucide-react";
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
};

function SidebarItem({ label, icon, href, active }: SidebarItemProps): React.JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
        active
          ? "bg-primary text-white shadow-md"
          : "text-slate-500 hover:bg-slate-100",
      )}
    >
      {icon}
      <span>{label}</span>
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 -z-10 rounded-2xl bg-primary"
        />
      )}
    </Link>
  );
}

export const Sidebar = (): React.JSX.Element => {
  const pathname = usePathname();
  const { user, hasOrganization } = useAuth();
  const displayName = user?.fullName ?? user?.name ?? "Guest Educator";

  const activeCount = DASHBOARD_NAV_ITEMS.filter((item) =>
    isActive(pathname ?? "", item.route),
  ).length;
  if (process.env.NODE_ENV === "development" && activeCount > 1) {
    console.warn("Sidebar active state error: multiple active items detected.");
  }

  return (
    <aside className="glass-panel hidden min-h-screen w-72 flex-col justify-between rounded-3xl p-6 lg:flex">
      <div className="space-y-8">
        <Link href="/app" className="flex items-center gap-3 text-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">SkillStorm</p>
            <p className="text-sm text-slate-500">EduTo Suite</p>
          </div>
        </Link>

        <nav className="space-y-2">
          {DASHBOARD_NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.route}
              label={item.label}
              icon={item.icon}
              href={item.route}
              active={isActive(pathname ?? "", item.route)}
            />
          ))}
        </nav>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            ) : (
              <AvatarFallback>
                {displayName
                  .split(" ")
                  .map((n) => n[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() ?? "SS"}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {displayName}
            </p>
            {user?.organizationRole && (
              <Badge variant="success" className="w-fit capitalize">
                {hasOrganization ? user.organizationRole.toLowerCase() : "bez školy"}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
