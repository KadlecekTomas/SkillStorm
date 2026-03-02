"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  ScrollText,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type PlatformNavItem = {
  label: string;
  icon: React.ReactNode;
  href: string;
};

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  {
    label: "Platform Overview",
    icon: <LayoutDashboard className="h-4 w-4" />,
    href: "/app/platform",
  },
  {
    label: "Organizations",
    icon: <Building2 className="h-4 w-4" />,
    href: "/app/platform/organizations",
  },
  {
    label: "Global Users",
    icon: <Users className="h-4 w-4" />,
    href: "/app/platform/users",
  },
  {
    label: "Audit Logs",
    icon: <ScrollText className="h-4 w-4" />,
    href: "/app/platform/audit",
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app/platform") {
    return pathname === "/app/platform";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

type PlatformSidebarItemProps = {
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
};

function PlatformSidebarItem({
  label,
  icon,
  href,
  active,
}: PlatformSidebarItemProps): React.JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-gray-900 text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export const PlatformSidebar = (): React.JSX.Element => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const displayName = user?.fullName ?? user?.name ?? "Platform Admin";

  return (
    <aside className="hidden min-h-screen w-60 flex-shrink-0 flex-col justify-between border-r border-gray-200 bg-white px-3 py-5 lg:flex">
      <div className="space-y-5">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100">
            <ShieldCheck className="h-4 w-4 text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-gray-900">
              SkillStorm
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Platform Admin</p>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <nav className="space-y-0.5">
          {PLATFORM_NAV_ITEMS.map((item) => (
            <PlatformSidebarItem
              key={item.href}
              label={item.label}
              icon={item.icon}
              href={item.href}
              active={isActive(pathname ?? "", item.href)}
            />
          ))}
        </nav>
      </div>

      {/* User card + logout */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </button>

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7">
              {user?.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={displayName} />
              ) : (
                <AvatarFallback className="bg-gray-200 text-xs text-gray-700">
                  {displayName
                    .split(" ")
                    .map((n) => n[0] ?? "")
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-900">
                {displayName}
              </p>
              <span className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
                Superadmin
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
