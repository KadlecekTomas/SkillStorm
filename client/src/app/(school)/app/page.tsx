"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { withGuard } from "@/lib/guard/withGuard";
import { StudentDashboard } from "./components/StudentDashboard";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { DirectorDashboard } from "./components/DirectorDashboard";

/**
 * Dashboard entrypoint. Derives behavior only from organization context + permissions (role).
 * No mode-based branching: personal mode is on /app/personal.
 */
function DashboardPage() {
  const router = useRouter();
  const { context } = useAuth();
  const { hasRole } = usePermissions();

  const isStudent = hasRole("STUDENT");
  const isTeacher = hasRole("TEACHER");
  const isDirectorOrOwner = hasRole("DIRECTOR") || hasRole("OWNER");
  const isParent = hasRole("PARENT");

  useEffect(() => {
    if (context?.mode === "personal") {
      router.replace("/app/personal");
    } else if (isParent) {
      // Guardian Etapa B: rodičovský kontext žije v rodinném prostoru.
      router.replace("/app/family");
    }
  }, [context?.mode, isParent, router]);

  if (context?.mode === "personal" || isParent) {
    return null;
  }

  return (
    <div className="space-y-8">
      {isStudent && <StudentDashboard />}
      {isTeacher && <TeacherDashboard />}
      {isDirectorOrOwner && !isTeacher && <DirectorDashboard />}
      {!isStudent && !isTeacher && !isDirectorOrOwner && (
        <p className="text-sm text-slate-500">Přehled není k dispozici.</p>
      )}
    </div>
  );
}

export default withGuard()(DashboardPage);
