"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { withGuard } from "@/lib/guard/withGuard";

/**
 * Personal-mode dashboard: no organization context.
 * Separate from role-based dashboard; no mode branching in main /dashboard tree.
 */
function PersonalDashboardPage() {
  return (
    <div className="space-y-8">
      <Card className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Bez školy
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Některé týmové funkce vyžadují školu
          </h2>
          <p className="text-sm text-slate-600">
            Můžeš pokračovat bez školy, nebo si školu založit či se připojit
            a odemknout správu tříd, pozvánky a certifikovaný obsah.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="rounded-2xl">
            <Link href="/dashboard/onboarding">Založit nebo se připojit</Link>
          </Button>
          <Button disabled variant="outline" title="Vyžaduje školu" className="rounded-2xl">
            Pozvat členy
          </Button>
          <Button disabled variant="outline" title="Vyžaduje školu" className="rounded-2xl">
            Spravovat třídy
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default withGuard()(PersonalDashboardPage);
