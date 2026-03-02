"use client";

import { usePathname } from "next/navigation";
import { PlatformSidebar, PLATFORM_NAV_ITEMS } from "@/components/layout/platform-sidebar";

type PlatformMainLayoutProps = {
  children: React.ReactNode;
};

function getPageTitle(pathname: string): string {
  const match = PLATFORM_NAV_ITEMS.find((item) =>
    item.href === "/app/platform"
      ? pathname === "/app/platform"
      : pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  return match?.label ?? "Platform Admin";
}

export const PlatformMainLayout = ({
  children,
}: PlatformMainLayoutProps): React.JSX.Element => {
  const pathname = usePathname() ?? "/app/platform";
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <PlatformSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3.5">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400">
              Platform Layer
            </p>
            <h1 className="text-base font-semibold text-gray-900">
              {pageTitle}
            </h1>
          </div>
          <span className="rounded-xl bg-amber-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
            SUPERADMIN
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};
