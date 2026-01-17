"use client";

import { type JSX, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { getRoleHomePath } from "@/utils/permissions";

export default function RegisterPage(): JSX.Element {
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
          Create space
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Register for EduTo
        </h1>
        <p className="text-sm text-slate-500">
          Teachers can spin up organizations, invite students and co-manage classrooms.
        </p>
      </div>
      <AuthForm key="register" mode="register" />
    </div>
  );
}
