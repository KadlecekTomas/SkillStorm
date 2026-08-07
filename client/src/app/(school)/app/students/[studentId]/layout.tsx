"use client";

import type { ReactNode } from "react";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import type { OrganizationRole } from "@/types";

const STUDENT_DETAIL_ROLES: OrganizationRole[] = [
  "OWNER",
  "DIRECTOR",
  "TEACHER",
];

export default function StudentDetailLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <GuardBoundary
      requireRoles={STUDENT_DETAIL_ROLES}
      requireSchoolWorkspace
    >
      {children}
    </GuardBoundary>
  );
}
