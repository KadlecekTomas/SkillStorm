import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Home,
  LibraryBig,
  LineChart,
  Settings,
  Users2,
} from "lucide-react";
import { PermissionKey } from "@/types";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey | PermissionKey[];
};

export const dashboardNav: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: Home },
  {
    title: "Classrooms",
    href: "/dashboard/classrooms",
    icon: Users2,
    permission: PermissionKey.MANAGE_STUDENTS,
  },
  {
    title: "Tests",
    href: "/dashboard/tests",
    icon: ClipboardList,
    permission: [
      PermissionKey.CREATE_TEST,
      PermissionKey.EDIT_TEST,
      PermissionKey.VIEW_RESULTS,
    ],
  },
  {
    title: "Library",
    href: "/dashboard/library",
    icon: LibraryBig,
    permission: [PermissionKey.CREATE_TEST, PermissionKey.EDIT_TEST],
  },
  {
    title: "Results",
    href: "/dashboard/results",
    icon: LineChart,
    permission: PermissionKey.VIEW_RESULTS,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    permission: PermissionKey.MANAGE_TEACHERS,
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: LineChart,
    permission: PermissionKey.VIEW_ANALYTICS,
  },
];

export const roleBadges: Record<string, { label: string; tone: string }> = {
  teacher: { label: "Teacher", tone: "success" },
  student: { label: "Student", tone: "info" },
  admin: { label: "Admin", tone: "warning" },
};

export const gradeFilters = [
  { label: "All grades", value: "All" },
  { label: "7th Grade", value: "GRADE_7" },
  { label: "8th Grade", value: "GRADE_8" },
  { label: "9th Grade", value: "GRADE_9" },
];
export const subjectFilters = ["Mathematics", "Science", "Languages"];
