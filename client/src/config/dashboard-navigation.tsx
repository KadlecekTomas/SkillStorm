"use client";

import type { ReactNode } from "react";
import {
  Home,
  Users2,
  ClipboardList,
  LibraryBig,
  LineChart,
  Settings,
} from "lucide-react";

export type DashboardNavItem = {
  label: string;
  route: string;
  icon: ReactNode;
};

const iconClass = "h-4 w-4";

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Overview", route: "/app", icon: <Home className={iconClass} /> },
  { label: "Classrooms", route: "/app/classrooms", icon: <Users2 className={iconClass} /> },
  { label: "Tests", route: "/app/tests", icon: <ClipboardList className={iconClass} /> },
  { label: "Library", route: "/app/library", icon: <LibraryBig className={iconClass} /> },
  { label: "Results", route: "/app/results", icon: <LineChart className={iconClass} /> },
  { label: "Settings", route: "/app/settings", icon: <Settings className={iconClass} /> },
];
