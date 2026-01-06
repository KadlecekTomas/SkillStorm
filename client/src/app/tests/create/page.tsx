"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";

function CreateTestPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    organizationId: "",
    questions: [
      { text: "Kolik je 2 + 2?", type: "MULTIPLE_CHOICE", correctAnswer: "4" },
    ],
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setError(null);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        organizationId: form.organizationId || undefined,
        questions: form.questions.map((q, idx) => ({
          text: q.text,
          type: q.type,
          order: idx + 1,
          options: [{ text: q.correctAnswer }, { text: "Nesprávně" }],
          correctAnswer: q.correctAnswer,
          score: 1,
        })),
      };
      const created = await fetchWithAuth<{ id: string }>("POST", "/tests", {
        body: payload,
      });
      setSubmitted(true);
      setForm({
        title: "",
        description: "",
        organizationId: "",
        questions: [{ text: "Kolik je 2 + 2?", type: "MULTIPLE_CHOICE", correctAnswer: "4" }],
      });
      if (created?.id) {
        router.replace(`/tests/${created.id}`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Chyba při vytváření testu");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Create policy test
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">
          Create new assessment
        </h1>
        <p className="text-sm text-slate-500">
          Guarded route – dostupná pouze pro role s oprávněním CREATE_TEST.
        </p>
      </div>
      <Card className="space-y-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft">
        <Input
          placeholder="Název testu"
          value={form.title}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, title: event.target.value }))
          }
        />
        <Input
          placeholder="Organization ID (ponech prázdné pro aktuální)"
          value={form.organizationId}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, organizationId: event.target.value }))
          }
        />
        <Textarea
          placeholder="Krátký popis"
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, description: event.target.value }))
          }
        />
        <Button className="w-full rounded-2xl" onClick={handleSubmit}>
          Uložit koncept
        </Button>
      </Card>
      {error && <Alert title="Chyba" description={error} variant="warning" />}
      {submitted && (
        <Alert
          title="Draft uložen"
          description="Nový assessment je připraven v sekci Tests."
          variant="success"
        />
      )}
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST],
})(CreateTestPage);
