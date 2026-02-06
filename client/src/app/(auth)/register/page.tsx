"use client";

import { type JSX, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading, isAuthenticated, context } = useAuth();

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

  // Auth invariant:
  // Authenticated users must never access the register page.
  // Register is reachable only after explicit logout.
  useEffect(() => {
    if (!isAuthenticated) return;

    if (context?.mode === "organization") {
      router.replace("/dashboard");
    } else if (context?.mode === "platform") {
      router.replace("/dashboard/platform");
    } else if (context?.mode === "personal") {
      router.replace("/onboarding/create-organization");
    } else {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, context?.mode, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Načítám…" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Přesměrovávám…" />
      </div>
    );
  }

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
