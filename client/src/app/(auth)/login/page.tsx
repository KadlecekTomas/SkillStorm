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

  const afterStudentSession = searchParams.get("po-zakovskem-rezimu") === "1";

  return (
    <div className="space-y-6">
      {afterStudentSession && (
        // Guardian Etapa C: návratová obrazovka srozumitelná i dítěti —
        // žákovský režim skončil, práce je uložená, dál pokračuje rodič.
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[15px] font-bold text-emerald-900">
            Žákovský režim skončil — všechno je uložené. 👍
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Teď prosím předej zařízení rodiči. Rodič se přihlásí svým heslem.
          </p>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Přihlášení do SkillStorm
        </h1>
        <p className="text-sm text-slate-500">
          Přihlaste se pomocí svého účtu.
        </p>
      </div>

      <AuthForm key="login" mode="login" />

      <p className="text-center text-sm text-slate-500">
        <Link
          href="/reset-password"
          className="font-medium text-slate-700 underline hover:text-slate-900"
        >
          Zapomněli jste heslo?
        </Link>
      </p>

      <p className="text-center text-sm text-slate-500">
        Nemáte účet?{" "}
        <Link
          href={registerHref}
          className="font-medium text-slate-700 underline hover:text-slate-900"
        >
          Zaregistrujte se
        </Link>
      </p>
    </div>
  );
}
