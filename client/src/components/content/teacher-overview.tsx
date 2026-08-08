"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

type TeacherOverviewProps = {
  actions?: { label: string; href: string }[];
  highlight: {
    title: string;
    description: string;
    metric: string;
  };
  onAction?: (href: string, label: string) => void;
};

export const TeacherOverview = ({
  actions = [],
  highlight,
  onAction,
}: TeacherOverviewProps): React.JSX.Element => {
  const router = useRouter();
  const primaryAction = actions[0] ?? null;

  const navigate = (href: string, label: string): void => {
    if (onAction) {
      onAction(href, label);
      return;
    }
    if (href.startsWith("http")) {
      if (typeof window !== "undefined") {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    } else {
      router.push(href);
    }
  };

  return (
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
          {primaryAction && (
            <Button
              variant="outline"
              size="icon"
              className="rounded-2xl"
              onClick={() => navigate(primaryAction.href, primaryAction.label)}
              aria-label={primaryAction.label}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={`${action.label}:${action.href}`}
                variant="ghost"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs"
                onClick={() => navigate(action.href, action.label)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
};
