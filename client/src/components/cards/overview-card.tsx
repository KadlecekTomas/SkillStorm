"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

type OverviewCardProps = {
  title: string;
  value: string;
  delta?: string;
  icon: ReactNode;
  accent?: string;
};

export const OverviewCard = ({
  title,
  value,
  delta,
  icon,
  accent = "bg-emerald-50 text-emerald-600",
}: OverviewCardProps): React.JSX.Element => (
  <Card className="space-y-3 rounded-xl border bg-white shadow-sm">
    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accent)}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {delta && <p className="mt-0.5 text-sm text-slate-500">{delta}</p>}
    </div>
  </Card>
);
