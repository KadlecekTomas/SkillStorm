"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

type TeacherOverviewProps = {
  actions?: { label: string; href: string }[];
  highlight: {
    title: string;
    description: string;
    metric: string;
  };
};

export const TeacherOverview = ({
  actions = [],
  highlight,
}: TeacherOverviewProps) => (
  <motion.div whileHover={{ y: -4 }}>
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{highlight.title}</p>
          <p className="text-lg font-semibold text-slate-900">
            {highlight.metric}
          </p>
          <p className="text-sm text-slate-600">{highlight.description}</p>
        </div>
        <Button variant="outline" size="icon" className="rounded-2xl">
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            className="rounded-full border border-slate-200 px-4 py-2 text-xs"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  </motion.div>
);
