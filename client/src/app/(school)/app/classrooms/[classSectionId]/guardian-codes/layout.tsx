"use client";

import type { ReactNode } from "react";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import { PermissionKey, type OrganizationRole } from "@/types";

const GUARDIAN_CODE_ROLES: OrganizationRole[] = [
  "OWNER",
  "DIRECTOR",
  "TEACHER",
];

export default function GuardianCodesLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <GuardBoundary
      requireRoles={GUARDIAN_CODE_ROLES}
      requirePerms={[PermissionKey.INVITE_STUDENTS]}
      requireSchoolWorkspace
    >
      {children}
    </GuardBoundary>
  );
}
