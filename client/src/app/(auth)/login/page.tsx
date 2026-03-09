"use client";

import { type JSX, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AuthForm } from "@/components/forms/auth-form";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * Login page: UI only. Post-auth navigation is handled solely by PostAuthResolver in (auth) layout.
 */
export default function LoginPage(): JSX.Element {
  const { isLoading, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const registerHref = useMemo(() => {
    const redirect = searchParams.get("redirect") ?? searchParams.get("from");
    if (!redirect) return "/register";
    const params = new URLSearchParams();
    params.set("redirect", redirect);
    return `/register?${params.toString()}`;
  }, [searchParams]);

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
      <p className="text-center text-sm text-slate-500">
        <Link href="/reset-password" className="font-medium text-slate-700 underline hover:text-slate-900">
          Zapomněli jste heslo?
        </Link>
      </p>
      <p className="text-center text-sm text-slate-500">
        Nemáte účet?{" "}
        <Link href={registerHref} className="font-medium text-slate-700 underline hover:text-slate-900">
          Zaregistrujte se
        </Link>
      </p>
    </div>
  );
}
