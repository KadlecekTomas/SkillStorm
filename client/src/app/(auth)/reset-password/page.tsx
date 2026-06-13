"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { fetchWithAuth } from "@/lib/http/client";
import { showToastOnce } from "@/utils/toast";

export default function ResetPasswordRequestPage(): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetchWithAuth("POST", "/auth/forgot-password", {
        body: { email: email.trim() },
      });
      setSent(true);
      showToastOnce("Pokud účet existuje, byl odeslán odkaz pro obnovení hesla.", { type: "success" });
    } catch {
      setSent(true);
      showToastOnce("Pokud účet existuje, byl odeslán odkaz pro obnovení hesla.", { type: "success" });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-slate-900">Zkontrolujte e-mail</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pokud je účet s touto adresou zaregistrován, poslali jsme odkaz pro obnovení hesla.
          </p>
          <Link href="/login">
            <Button variant="outline" className="mt-4">Zpět na přihlášení</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět na přihlášení
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Obnovení hesla</h1>
        <p className="text-sm text-slate-500">
          Zadejte e-mail účtu a pošleme vám odkaz pro nastavení nového hesla.
        </p>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vas@email.cz"
            required
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Odesílám…" : "Odeslat odkaz"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
