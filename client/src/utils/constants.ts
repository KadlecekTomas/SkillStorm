import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Home,
  LibraryBig,
  LineChart,
  Settings,
  Users2,
} from "lucide-react";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const dashboardNav: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: Home },
  { title: "Classrooms", href: "/dashboard/classrooms", icon: Users2 },
  { title: "Tests", href: "/dashboard/tests", icon: ClipboardList },
  { title: "Library", href: "/dashboard/library", icon: LibraryBig },
  { title: "Results", href: "/dashboard/results", icon: LineChart },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export const roleBadges: Record<string, { label: string; tone: string }> = {
  teacher: { label: "Teacher", tone: "success" },
  student: { label: "Student", tone: "info" },
  admin: { label: "Admin", tone: "warning" },
};

export const gradeFilters = ["All", "1st Grade", "2nd Grade", "3rd Grade"];
export const subjectFilters = ["Mathematics", "Science", "Languages"];
