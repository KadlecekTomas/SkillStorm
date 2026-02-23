"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";

function CreateTestPage(): React.JSX.Element {
  const router = useRouter();
  const { org } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) {
      setError("Nejprve vyber organizaci.");
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      setError("Název testu musí mít alespoň 3 znaky.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const created = await fetchWithAuth<{ id: string }>("POST", "/tests", {
        body: {
          title: title.trim(),
          description: description.trim() || undefined,
          organizationId: org.id,
          status: "DRAFT",
        },
      });
      const id = created && typeof created === "object" && "id" in created ? (created as { id: string }).id : null;
      if (id) {
        router.push(`/dashboard/tests/${id}`);
      } else {
        router.push("/dashboard/tests");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vytvoření testu se nezdařilo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/tests" className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět na testy
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Vytvořit test</h1>
        <p className="text-sm text-slate-500">Zadej název a popis. Po vytvoření můžeš přidat otázky a přiřadit třídě.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Název testu *</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="např. Písemka – Zlomky"
              minLength={3}
              maxLength={255}
              className="w-full"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Popis (nepovinné)</span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krátký popis testu"
              className="w-full"
            />
          </label>
          {error && (
            <Alert title="Chyba" description={error} variant="warning" />
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Vytvářím…" : "Vytvořit test"}
            </Button>
            <Link href="/dashboard/tests">
              <Button type="button" variant="outline">Zrušit</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST],
})(CreateTestPage);
