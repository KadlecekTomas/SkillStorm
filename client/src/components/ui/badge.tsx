"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        success: "bg-emerald-100 text-emerald-700",
        info: "bg-blue-100 text-blue-700",
        warning: "bg-amber-100 text-amber-700",
        neutral: "bg-slate-100 text-slate-700",
        secondary: "bg-slate-100 text-slate-800 border border-slate-200",
        outline: "border border-slate-200 bg-transparent text-slate-700",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

export const Badge = ({ className, variant, ...props }: BadgeProps): React.JSX.Element => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
