"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { dashboardNav } from "@/utils/constants";
import { cn } from "@/utils/cn";
import { GraduationCap } from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { useMemo } from "react";

export const Sidebar = () => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { can, permissions } = usePermissions();
  const displayName = user?.fullName ?? user?.name ?? "Guest Educator";

  const accessibleNav = useMemo(
    () =>
      dashboardNav.filter((item) => {
        if (!item.permission) return true;
        const required = Array.isArray(item.permission)
          ? item.permission
          : [item.permission];
        return required.some((perm) => can(perm));
      }),
    [can],
  );

  return (
    <aside className="glass-panel hidden min-h-screen w-72 flex-col justify-between rounded-3xl p-6 lg:flex">
      <div className="space-y-8">
        <Link href="/dashboard" className="flex items-center gap-3 text-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">SkillStorm</p>
            <p className="text-sm text-slate-500">EduTo Suite</p>
          </div>
        </Link>

        <nav className="space-y-2">
          {accessibleNav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-white shadow-md"
                    : "text-slate-500 hover:bg-slate-100",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 -z-10 rounded-2xl bg-primary"
                  />
                )}
              </Link>
            );
          })}
          {accessibleNav.length === 0 && (
            <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-600">
              Žádný modul zatím nemáš k dispozici. Požádej správce o přidání oprávnění.
            </div>
          )}
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
                {user.organizationRole.toLowerCase()}
              </Badge>
            )}
            {!permissions.length && (
              <Badge variant="warning" className="w-fit border-amber-300 text-amber-600">
                Omezený přístup
              </Badge>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
