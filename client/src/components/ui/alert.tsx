"use client";

import { cn } from "@/utils/cn";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

type AlertProps = {
  title: string;
  description?: string | ReactNode;
  variant?: "default" | "success" | "warning";
};

const variantStyles: Record<
  NonNullable<AlertProps["variant"]>,
  { wrapper: string; icon: typeof AlertCircle }
> = {
  default: { wrapper: "bg-slate-50 text-slate-700", icon: Info },
  success: { wrapper: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  warning: { wrapper: "bg-amber-50 text-amber-700", icon: AlertCircle },
};

export const Alert = ({
  title,
  description,
  variant = "default",
}: AlertProps) => {
  const Icon = variantStyles[variant].icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3 text-sm",
        variantStyles[variant].wrapper,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4" />
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm">{description}</p>}
      </div>
    </div>
  );
};
