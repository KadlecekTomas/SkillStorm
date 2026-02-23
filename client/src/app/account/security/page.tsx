"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorAlert } from "@/components/ui/alert";
import { fetchWithAuth } from "@/lib/http/client";
import { showToastOnce } from "@/utils/toast";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "@/lib/password-strength";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength";

export default function AccountSecurityPage(): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!meetsPasswordPolicy(newPassword)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Nové heslo a potvrzení se neshodují.");
      return;
    }
    setLoading(true);
    try {
      await fetchWithAuth("POST", "/auth/change-password", {
        body: {
          currentPassword,
          newPassword,
        },
      });
      showToastOnce("Heslo bylo změněno.", { type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Změna hesla se nezdařila.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/app" className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět na přehled
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Bezpečnost</h1>
        <p className="text-sm text-slate-500">
          Změna hesla a nastavení účtu.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Změna hesla</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="current" className="block text-sm font-medium text-slate-700">
              Současné heslo
            </label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="new" className="block text-sm font-medium text-slate-700">
              Nové heslo
            </label>
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
              minLength={8}
              required
            />
            <PasswordStrengthIndicator password={newPassword} className="mt-2" />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
              Potvrzení nového hesla
            </label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
              minLength={8}
              required
            />
          </div>
          {error && (
            <ErrorAlert title="Chyba" description={error} />
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Ukládám…" : "Změnit heslo"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
