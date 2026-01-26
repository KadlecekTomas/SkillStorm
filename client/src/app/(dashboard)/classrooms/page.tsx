"use client";

import { withPermission } from "@/components/access/with-permission";
import { PermissionKey } from "@/types";
import { ClassroomsPageContent } from "@/components/pages/classrooms/classrooms-page";

function ClassroomsPage() {
  return <ClassroomsPageContent />;
}

export default withPermission([
  PermissionKey.VIEW_RESULTS,
  PermissionKey.MANAGE_STUDENTS,
])(ClassroomsPage);
