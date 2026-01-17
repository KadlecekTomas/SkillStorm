"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { fetchWithAuth } from "@/lib/http/client";

type ClassSection = { id: string; label?: string; grade?: string };

export default function AssignTestPage(): React.JSX.Element {
  const { testId } = useParams<{ testId: string }>();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [form, setForm] = useState({
    classSectionId: "",
    openAt: new Date().toISOString(),
    closeAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    maxAttempts: 1,
    shuffle: true,
    showExplain: "after_close",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchWithAuth<ClassSection[]>("GET", "/class-sections")
      .then((data) => setClasses(data ?? []))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Nepodařilo se načíst třídy";
        setError(message);
      });
  }, []);

  const handleAssign = async () => {
    setError(null);
    try {
      await fetchWithAuth("POST", `/tests/${testId}/assign`, {
        body: {
          classSectionId: form.classSectionId,
          organizationId: undefined,
          openAt: form.openAt,
          closeAt: form.closeAt,
          maxAttempts: form.maxAttempts,
          shuffle: form.shuffle,
          showExplain: form.showExplain,
        },
      });
      setSubmitted(true);
      router.back();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Assign selhal";
      setError(message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Přiřadit test</h1>
      <Card className="space-y-4 p-6">
        <label className="space-y-2 block">
          <span>Třída</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={form.classSectionId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, classSectionId: e.target.value }))
            }
          >
            <option value="">Vyber třídu</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label ?? c.id}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 block">
          <span>Open at</span>
          <Input
            type="datetime-local"
            value={form.openAt.slice(0, 16)}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                openAt: new Date(e.target.value).toISOString(),
              }))
            }
          />
        </label>
        <label className="space-y-2 block">
          <span>Close at</span>
          <Input
            type="datetime-local"
            value={form.closeAt.slice(0, 16)}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                closeAt: new Date(e.target.value).toISOString(),
              }))
            }
          />
        </label>
        <Button onClick={handleAssign}>Přiřadit</Button>
        {error && <Alert title="Chyba" description={error} variant="warning" />}
        {submitted && (
          <Alert title="Hotovo" description="Test přiřazen" variant="success" />
        )}
      </Card>
    </div>
  );
}
