"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { httpClient, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { showToastOnce } from "@/utils/toast";

const DEFAULT_LABEL = "2025/2026";
const DEFAULT_START = "2025-09-01";
const DEFAULT_END = "2026-06-30";

export const AcademicYearOnboardingScreen = (): React.JSX.Element => {
  const router = useRouter();
  const { syncProfile } = useAuth();
  const [name, setName] = useState(DEFAULT_LABEL);
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Zadej prosím název školního roku.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await httpClient.post("/academic-years", {
        name: trimmedName,
        startDate,
        endDate,
        isActive: true,
      });
      await syncProfile({ force: true });
      showToastOnce("Školní rok byl vytvořen. Aplikace je připravena.", {
        type: "success",
      });
      router.replace("/dashboard");
    } catch (err) {
      const msg =
        err instanceof HttpError
          ? (err.data as { message?: string })?.message ?? err.message
          : err instanceof Error
            ? err.message
            : "Nepodařilo se vytvořit školní rok.";
      setError(msg);
      showToastOnce(msg, { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 bg-gradient-to-br from-white via-emerald-50/50 to-slate-50 p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Nastavení školy
              </p>
              <h1 className="text-xl font-semibold text-slate-900">
                Zadej školní rok
              </h1>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Organizace vyžaduje přesně jeden aktivní školní rok. Všechny třídy,
            přiřazení a odevzdání jsou k němu vázané. Zadej název a datumy.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="year-name">
                Název školního roku
              </label>
              <Input
                id="year-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={DEFAULT_LABEL}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="start-date">
                Začátek
              </label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="end-date">
                Konec
              </label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                {error}
              </div>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Vytvářím…" : "Vytvořit školní rok"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
