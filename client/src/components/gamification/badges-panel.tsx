"use client";

import { Award, Medal, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { MembershipBadge } from "@/hooks/use-badges";

type BadgesPanelProps = {
  badges: MembershipBadge[];
};

const iconForBadge = (iconKey: string | null) => {
  switch (iconKey) {
    case "badge-perfect-score":
      return Star;
    case "badge-active-learner":
      return Medal;
    default:
      return Award;
  }
};

export function BadgesPanel({ badges }: BadgesPanelProps): React.JSX.Element {
  return (
    <Card className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
      <div>
        <p className="text-sm text-slate-500">Gamifikace</p>
        <h3 className="text-lg font-semibold text-slate-900">Získané odznaky</h3>
      </div>

      {badges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Zatím žádné odznaky</p>
          <p className="mt-1 text-sm text-slate-500">
            Dokonči test a první odznak se zobrazí tady.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {badges.map((badge) => {
            const Icon = iconForBadge(badge.iconKey);
            return (
              <div
                key={`${badge.code}-${badge.awardedAt}`}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{badge.name}</p>
                  <p className="text-sm text-slate-500">
                    {badge.description ?? "Odznak byl úspěšně získán."}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Získáno {new Date(badge.awardedAt).toLocaleDateString("cs-CZ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
