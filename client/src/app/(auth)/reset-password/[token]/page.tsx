"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ErrorAlert, WarningAlert } from "@/components/ui/alert";
import { fetchWithAuth } from "@/lib/http/client";
import { showToastOnce } from "@/utils/toast";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "@/lib/password-strength";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength";

export default function ResetPasswordWithTokenPage(): React.JSX.Element {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token ?? "";
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
      setError("Hesla se neshodují.");
      return;
    }
    if (!token) {
      setError("Chybí odkaz pro obnovení.");
      return;
    }
    setLoading(true);
    try {
      await fetchWithAuth("POST", "/auth/reset-password", {
        body: { token, newPassword },
      });
      showToastOnce("Heslo bylo nastaveno. Můžete se přihlásit.", { type: "success" });
      router.replace("/login");
    } catch {
      setError("Obnovení hesla se nepovedlo. Zkuste to znovu nebo požádejte o nový odkaz.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <WarningAlert title="Neplatný odkaz" description="Odkaz pro obnovení hesla je neplatný nebo chybí." />
        <Link href="/reset-password">
          <Button variant="outline">Žádat nový odkaz</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět na přihlášení
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Nové heslo</h1>
        <p className="text-sm text-slate-500">
          Zadejte nové heslo pro váš účet.
        </p>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
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
              minLength={8}
              required
            />
            <PasswordStrengthIndicator password={newPassword} className="mt-2" />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
              Potvrzení hesla
            </label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && (
            <ErrorAlert title="Chyba" description={error} />
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Ukládám…" : "Nastavit heslo"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
