"use client";

import { type JSX, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { getRoleHomePath } from "@/utils/permissions";

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, authStatus } = useAuth();
  const initialMode = useMemo(() => {
    const modeParam = searchParams.get("mode")?.toUpperCase();
    if (modeParam === "INDIVIDUAL" || modeParam === "CREATE_ORG" || modeParam === "JOIN_ORG") {
      return modeParam as "INDIVIDUAL" | "CREATE_ORG" | "JOIN_ORG";
    }
    if (searchParams.get("code")) return "JOIN_ORG";
    return "INDIVIDUAL";
  }, [searchParams]);
  const initialJoinCode = useMemo(() => searchParams.get("code") ?? "", [searchParams]);
  const initialJoinRole = useMemo(() => {
    const roleParam = searchParams.get("role")?.toUpperCase();
    if (roleParam === "STUDENT" || roleParam === "TEACHER" || roleParam === "PARENT") {
      return roleParam as "STUDENT" | "TEACHER" | "PARENT";
    }
    return undefined;
  }, [searchParams]);

  useEffect(() => {
    // ⛔ Neredirectuj během načítání nebo bootstrapu
    if (isLoading) return;
    if (authStatus !== "ready") return;
    // ⛔ Neredirectuj, pokud není uživatel
    if (!user) return;

    if (typeof window !== "undefined") {
      const joinIntent = window.sessionStorage.getItem("join_intent");
      if (joinIntent) {
        router.replace("/dashboard/onboarding");
        return;
      }
    }

    router.replace(getRoleHomePath(user));
  }, [user, router, isLoading, authStatus]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Create space
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Register for SkillStorm
        </h1>
        <p className="text-sm text-slate-500">
          Vyber si individuální účet, založ školu, nebo zvol připojení a dokonči ho v onboarding kroku.
        </p>
      </div>
      <AuthForm
        key={`register-${initialMode}-${initialJoinCode}`}
        mode="register"
        initialMode={initialMode}
        initialJoinCode={initialJoinCode}
        initialJoinRole={initialJoinRole}
      />
    </div>
  );
}
