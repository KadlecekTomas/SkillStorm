"use client";

import { withPermission } from "@/components/access/with-permission";
import { PermissionKey } from "@/types";
import { RestrictedView } from "@/components/access/restricted-view";

function ResultsPage() {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
      <h2 className="text-xl font-semibold text-slate-900">Analytics & results</h2>
      <p className="text-sm text-slate-600">
        Zde se zobrazí agregace výsledků, heatmapy otázek a exporty PDF. Data z RBAC rozhodují, zda
        můžeš vidět konkrétní třídy.
      </p>
      <RestrictedView description="Studenti vidí pouze své výsledky – ostatní sekce jsou dostupné pro učitele a vedení." />
    </div>
  );
}

export default withPermission(PermissionKey.VIEW_RESULTS)(ResultsPage);
