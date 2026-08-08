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
  return match?.label ?? "Správa platformy";
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
        <header className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6">
          <h1 className="text-base font-semibold text-gray-900">
            {pageTitle}
          </h1>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
};
