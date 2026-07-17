"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";

export type PriorityAlertItem = {
  id: string;
  text: string;
};

type PriorityAlertsProps = {
  alerts: PriorityAlertItem[];
  className?: string;
};

export function PriorityAlerts({ alerts, className }: PriorityAlertsProps): React.JSX.Element {
  if (!alerts.length) return <></>;

  return (
    <section
      className={cn("rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3", className)}
      aria-label="Prioritní upozornění"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-amber-900">Prioritní upozornění</h3>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-amber-800">
            {alerts.map((a) => (
              <li key={a.id}>{a.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
