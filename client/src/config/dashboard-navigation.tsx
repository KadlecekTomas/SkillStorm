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
} from "lucide-react";

export type DashboardNavItem = {
  label: string;
  route: string;
  icon: ReactNode;
};

const iconClass = "h-4 w-4";

/**
 * Výchozí navigace pro učitele / ředitele / vlastníka (a fallback rolí).
 * POZOR: obsahuje učitelské plochy (Třídy, Testy, Knihovna, Výsledky, Nastavení),
 * které žák nesmí dostat — pro STUDENT slouží samostatná sada níže.
 */
export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Přehled", route: "/app", icon: <Home className={iconClass} /> },
  { label: "Třídy", route: "/app/classrooms", icon: <Users2 className={iconClass} /> },
  { label: "Testy", route: "/app/tests", icon: <ClipboardList className={iconClass} /> },
  { label: "Knihovna", route: "/app/library", icon: <LibraryBig className={iconClass} /> },
  { label: "Výsledky", route: "/app/results", icon: <LineChart className={iconClass} /> },
  { label: "Nastavení", route: "/app/settings", icon: <Settings className={iconClass} /> },
];

/**
 * Navigace pro žáka. Obsahuje výhradně skutečné žákovské obrazovky:
 * - Přehled (dashboard),
 * - Moje úkoly (přidělená zadání),
 * - Moje výsledky (žákovská analytika vlastního výkonu).
 * Nesmí odkazovat na učitelské plochy (Třídy / Knihovna / učitelská diagnostika
 * `/app/results` / Nastavení školy).
 */
export const STUDENT_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Přehled", route: "/app", icon: <Home className={iconClass} /> },
  { label: "Moje úkoly", route: "/app/assignments", icon: <ClipboardList className={iconClass} /> },
  { label: "Moje výsledky", route: "/app/student/analytics", icon: <LineChart className={iconClass} /> },
];

/**
 * Rodič (guardian Etapa B) vidí jen rodinný prostor a nastavení — školní
 * navigace pro něj nemá význam a jen by mátla (jedna dominantní akce).
 */
export const PARENT_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Moje děti", route: "/app/family", icon: <HeartHandshake className={iconClass} /> },
  { label: "Nastavení", route: "/app/settings", icon: <Settings className={iconClass} /> },
];

/**
 * Vrátí navigační položky odpovídající roli.
 * - STUDENT: jen žákovské plochy (nikdy učitelské),
 * - PARENT: jen rodinný prostor + nastavení (guardian Etapa B),
 * - ostatní (TEACHER/DIRECTOR/OWNER/fallback): plná školní navigace.
 * PARENT NIKDY nesmí spadnout do defaultní plné školní navigace.
 */
export function getNavItemsForRole(
  role: string | null | undefined,
): DashboardNavItem[] {
  switch (role) {
    case "STUDENT":
      return STUDENT_NAV_ITEMS;
    case "PARENT":
      return PARENT_NAV_ITEMS;
    default:
      return DASHBOARD_NAV_ITEMS;
  }
}
