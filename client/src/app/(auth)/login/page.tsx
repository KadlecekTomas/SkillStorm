"use client";

import { type JSX, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { getRoleHomePath } from "@/utils/permissions";
import { AuthForm } from "@/components/forms/auth-form";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    router.replace(getRoleHomePath(user));
  }, [user, router]);

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
