"use client";

import type { ReactNode } from "react";
import {
  Home,
  Users2,
  ClipboardList,
  LibraryBig,
  LineChart,
  Settings,
  HeartHandshake,
  ListChecks,
} from "lucide-react";
import type { OrganizationRole } from "@/types";

export type DashboardNavItem = {
  label: string;
  route: string;
  icon: ReactNode;
};

const iconClass = "h-4 w-4";

/** Teacher/director/owner workspace. */
export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Přehled", route: "/app", icon: <Home className={iconClass} /> },
  { label: "Třídy", route: "/app/classrooms", icon: <Users2 className={iconClass} /> },
  { label: "Testy", route: "/app/tests", icon: <ClipboardList className={iconClass} /> },
  { label: "Knihovna", route: "/app/library", icon: <LibraryBig className={iconClass} /> },
  { label: "Výsledky", route: "/app/results", icon: <LineChart className={iconClass} /> },
  { label: "Nastavení", route: "/app/settings", icon: <Settings className={iconClass} /> },
];

/**
 * Žák má vlastní pracovní prostor. Nezobrazujeme mu učitelské moduly jen
 * proto, aby po kliknutí dostal 403 — každý viditelný cíl musí být jeho
 * legitimní workflow.
 */
export const STUDENT_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Přehled", route: "/app", icon: <Home className={iconClass} /> },
  { label: "Zadání", route: "/app/assignments", icon: <ListChecks className={iconClass} /> },
  { label: "Testy", route: "/app/tests", icon: <ClipboardList className={iconClass} /> },
  { label: "Knihovna", route: "/app/library", icon: <LibraryBig className={iconClass} /> },
  { label: "Výsledky", route: "/app/student/analytics", icon: <LineChart className={iconClass} /> },
  { label: "Nastavení", route: "/app/settings", icon: <Settings className={iconClass} /> },
];

/**
 * Rodič (guardian Etapa B) vidí jen rodinný prostor a nastavení — školní
 * navigace pro něj nemá význam a jen by mátla.
 */
export const PARENT_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Moje děti", route: "/app/family", icon: <HeartHandshake className={iconClass} /> },
  { label: "Nastavení", route: "/app/settings", icon: <Settings className={iconClass} /> },
];

export function getDashboardNavItems(
  role: OrganizationRole | null | undefined,
): DashboardNavItem[] {
  if (role === "PARENT") return PARENT_NAV_ITEMS;
  if (role === "STUDENT") return STUDENT_NAV_ITEMS;
  return DASHBOARD_NAV_ITEMS;
}
