"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { httpClient, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { showToastOnce } from "@/utils/toast";

const now = new Date();
const currentYear = now.getFullYear();
const defaultStartYear = now.getMonth() >= 8 ? currentYear : currentYear - 1;
const YEARS = Array.from({ length: 15 }, (_, i) => currentYear - 2 + i);

export const AcademicYearOnboardingScreen = (): React.JSX.Element => {
  const router = useRouter();
  const { org, orgState, syncProfile } = useAuth();
  const [startYear, setStartYear] = useState(defaultStartYear);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Obrana proti deadlocku: PENDING SCHOOL nikdy neposílá POST /academic-years.
    if (org?.type === "SCHOOL" && orgState === "PENDING") {
      router.replace("/onboarding/pending");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await httpClient.post("/academic-years", {
        startYear,
        isActive: true,
      });
      await syncProfile({ force: true });
      showToastOnce("Školní rok byl vytvořen. Aplikace je připravena.", {
        type: "success",
      });
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof HttpError) {
        const data = err.data as { code?: string; meta?: { code?: string }; message?: string } | undefined;
        const code = data?.code ?? data?.meta?.code ?? null;

        // Stavové kódy – nejsou to chyby, ale přechody ve stavovém automatu.
        if (code === "ORG_PENDING") {
          router.replace("/onboarding/pending");
          return;
        }
        if (code === "ORG_NOT_READY") {
          setError(
            "Organizace ještě není připravena. Dokonči prosím nastavení školy podle instrukcí na úvodní stránce.",
          );
          // Žádný toast – stavová informace.
          return;
        }

        const msg =
          (data?.message && data.message.trim().length > 0
            ? data.message
            : undefined) ?? "Nepodařilo se vytvořit školní rok. Zkus to prosím znovu.";
        setError(msg);
        // Onboarding řeší chyby inline – žádný error toast.
      } else {
        setError("Nepodařilo se vytvořit školní rok. Zkus to prosím znovu.");
      }
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
            přiřazení a odevzdání jsou k němu vázané. Vyber rok začátku (1. 9.).
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="start-year">
                Školní rok
              </label>
              <Select
                value={String(startYear)}
                onValueChange={(v) => setStartYear(Number(v))}
                disabled={isSubmitting}
              >
                <SelectTrigger id="start-year">
                  <SelectValue placeholder="Vyber rok" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}/{y + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
