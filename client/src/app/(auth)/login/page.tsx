"use client";

import { type JSX, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AuthForm } from "@/components/forms/auth-form";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const { context, isLoading, isAuthenticated } = useAuth();

  // Auth invariant:
  // Authenticated users must never access the login page.
  // Login is only reachable after explicit logout.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (context?.mode === "organization") {
      router.replace("/dashboard");
      return;
    }
    if (context?.mode === "platform") {
      router.replace("/dashboard/platform");
      return;
    }
    if (context?.mode === "personal") {
      router.replace("/onboarding/create-organization");
      return;
    }
    router.replace("/dashboard");
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
          Welcome back
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Sign in to SkillStorm
        </h1>
        <p className="text-sm text-slate-500">
          Use your EduTo credentials to access the unified dashboard.
        </p>
      </div>
      <AuthForm key="login" mode="login" />
    </div>
  );
}
