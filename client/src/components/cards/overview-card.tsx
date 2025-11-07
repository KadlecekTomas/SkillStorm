"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { motion } from "framer-motion";
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
}: OverviewCardProps) => (
  <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
    <Card className="space-y-4">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", accent)}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {delta && <p className="text-sm text-emerald-600">{delta}</p>}
      </div>
    </Card>
  </motion.div>
);
