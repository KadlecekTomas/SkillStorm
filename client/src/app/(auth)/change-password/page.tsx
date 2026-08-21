"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorAlert, InfoAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength";
import { useAuth } from "@/hooks/use-auth";
import { fetchWithAuth } from "@/lib/http/client";
import {
  meetsPasswordPolicy,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/password-strength";
import { showToastOnce } from "@/utils/toast";

export default function ChangePasswordPage(): React.JSX.Element {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, syncProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user?.mustChangePassword !== true) {
      router.replace("/app");
    }
  }, [isAuthenticated, isLoading, router, user?.mustChangePassword]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!meetsPasswordPolicy(newPassword)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Nová hesla se neshodují.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Nové heslo musí být jiné než dočasné heslo.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchWithAuth("POST", "/auth/change-password", {
        body: { currentPassword, newPassword },
        skipAuthRetry: true,
      });
      await syncProfile({ force: true });
      showToastOnce("Heslo bylo bezpečně změněno.", { type: "success" });
      router.replace("/app");
    } catch {
      setError(
        "Heslo se nepodařilo změnit. Zkontrolujte dočasné heslo a zkuste to znovu.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !isAuthenticated || user?.mustChangePassword !== true) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Ověřuji účet…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Nastavte si vlastní heslo
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Přihlašujete se do nově vytvořeného účtu. Než budete pokračovat,
          nahraďte jednorázové dočasné heslo vlastním.
        </p>
      </div>

      <InfoAlert
        title="Tento krok nelze přeskočit"
        description="Dočasné heslo po úspěšné změně přestane platit a ostatní relace účtu budou ukončeny."
      />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
              Dočasné heslo
            </label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
              Nové heslo
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
            <PasswordStrengthIndicator password={newPassword} className="mt-2" />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
              Potvrzení nového hesla
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          {error ? <ErrorAlert title="Změna se nezdařila" description={error} /> : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Ukládám nové heslo…" : "Změnit heslo a pokračovat"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
