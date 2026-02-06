"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DASHBOARD_CLASSROOMS_PATH = "/dashboard/classrooms";

/**
 * Shown when org.status === ACTIVE and org.readiness === NOT_READY (no class yet).
 * No dashboard API calls; single CTA to create first class.
 */
export default function OnboardingSetupPage(): React.JSX.Element {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-50 p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Příprava školy
              </p>
              <h1 className="text-xl font-semibold text-slate-900">
                Vaše škola je aktivní, ale ještě není připravena.
              </h1>
            </div>
          </div>

          <p className="text-slate-700">
            Pro pokračování je potřeba vytvořit alespoň jednu třídu.
          </p>

          <Button asChild className="w-full" size="lg">
            <Link href={DASHBOARD_CLASSROOMS_PATH}>Vytvořit první třídu</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
