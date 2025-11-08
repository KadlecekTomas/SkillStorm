"use client";

import { Button } from "@/components/ui/button";
import { Bell, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/utils/constants";
import { PermissionGate } from "@/components/access/permission-gate";
import { PermissionKey } from "@/types";

export const AppHeader = () => {
  const pathname = usePathname();
  const active = dashboardNav.find((item) => pathname.startsWith(item.href));

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-soft"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Current module</p>
        <h1 className="text-xl font-semibold text-slate-900">
          {active?.title ?? "Dashboard"}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-2xl">
          <Bell className="h-4 w-4" />
        </Button>
        <PermissionGate
          permission={PermissionKey.CREATE_TEST}
          fallback={
            <Button className="rounded-2xl opacity-60" variant="outline" disabled>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Limited</span>
            </Button>
          }
        >
          <Button className="rounded-2xl">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
          </Button>
        </PermissionGate>
      </div>
    </motion.header>
  );
};
