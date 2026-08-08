"use client";

import { ClassroomsPageContent } from "@/components/pages/classrooms/classrooms-page";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";

const STAFF_ROLES: OrganizationRole[] = ["OWNER", "DIRECTOR", "TEACHER"];

function ClassroomsPage(): React.JSX.Element {
  return <ClassroomsPageContent />;
}

export default withGuard({
  requireRoles: STAFF_ROLES,
  requireSchoolWorkspace: true,
})(ClassroomsPage);
