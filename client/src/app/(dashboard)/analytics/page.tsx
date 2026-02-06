"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PermissionKey } from "@/types";
import { withGuard } from "@/lib/guard/withGuard";
import { useRoleView } from "@/hooks/use-role-view";

function AnalyticsRedirectPage() {
  const router = useRouter();
  const roleView = useRoleView();

  useEffect(() => {
    if (!roleView) return;
    if (roleView === "student") {
      router.replace("/student/analytics");
      return;
    }
    if (roleView === "teacher" || roleView === "director" || roleView === "owner") {
      router.replace("/teacher/analytics");
      return;
    }
    router.replace("/dashboard");
  }, [roleView, router]);

  return null;
}

export default withGuard({
  requirePerms: [PermissionKey.VIEW_RESULTS],
  requireSchoolWorkspace: true,
})(AnalyticsRedirectPage);
