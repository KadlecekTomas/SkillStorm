"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

/*
 * Pilulky (design reference: .pill) — plné signální barvy s bílým textem,
 * tučné písmo, tabular-nums pro číselné hodnoty (XP, streak, procenta).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold tabular-nums",
  {
    variants: {
      variant: {
        success: "bg-accent text-white",
        info: "bg-xp text-white",
        warning: "bg-streak text-white",
        danger: "bg-danger text-white",
        neutral: "bg-surface text-ink-muted",
        secondary: "bg-accent-soft text-accent-deep",
        outline: "border border-line-strong bg-transparent text-ink-muted",
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
