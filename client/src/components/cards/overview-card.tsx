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
  accent = "bg-accent-soft text-accent-deep",
}: OverviewCardProps): React.JSX.Element => (
  <Card className="space-y-3">
    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accent)}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-semibold text-ink-muted">{title}</p>
      <p className="text-3xl font-extrabold text-ink tabular-nums">{value}</p>
      {delta && <p className="mt-0.5 text-sm text-ink-muted">{delta}</p>}
    </div>
  </Card>
);
