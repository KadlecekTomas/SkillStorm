"use client";

import { type JSX, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * Register page: UI only. Post-auth navigation is handled solely by PostAuthResolver in (auth) layout.
 */
export default function RegisterPage(): JSX.Element {
  const searchParams = useSearchParams();
  const { isLoading, isAuthenticated } = useAuth();

  const initialMode = useMemo(() => {
    const modeParam = searchParams.get("mode")?.toUpperCase();
    if (
      searchParams.get("inviteToken") ||
      searchParams.get("invite") ||
      searchParams.get("token") ||
      searchParams.get("code")
    ) return "JOIN_ORG";
    if (modeParam === "INDIVIDUAL" || modeParam === "CREATE_ORG" || modeParam === "JOIN_ORG") {
      return modeParam as "INDIVIDUAL" | "CREATE_ORG" | "JOIN_ORG";
    }
    return "INDIVIDUAL";
  }, [searchParams]);
  const initialJoinCode = useMemo(
    () =>
      searchParams.get("inviteToken") ??
      searchParams.get("invite") ??
      searchParams.get("token") ??
      searchParams.get("code") ??
      "",
    [searchParams],
  );

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
        <h1 className="text-2xl font-semibold text-slate-900">
          Vytvoření účtu v EduTo
        </h1>

        <p className="text-sm text-slate-500">
          Vytvořte si účet a pokračujte do nastavení.
        </p>
      </div>

      <AuthForm
        key={`register-${initialMode}-${initialJoinCode}`}
        mode="register"
        initialMode={initialMode}
        initialJoinCode={initialJoinCode}
      />
    </div>
  );
}
