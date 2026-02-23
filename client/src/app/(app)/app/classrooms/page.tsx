"use client";

import { ClassroomsPageContent } from "@/components/pages/classrooms/classrooms-page";
import { withGuard } from "@/lib/guard/withGuard";

function ClassroomsPage(): React.JSX.Element {
  return <ClassroomsPageContent />;
}

export default withGuard({ requireSchoolWorkspace: true })(ClassroomsPage);
