"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/utils/cn";

/*
 * Progress bar (design reference: ProgressBar) — surface dráha, zelená
 * výplň s horním „gloss" proužkem, plynulý přechod šířky.
 */
export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-3 w-full overflow-hidden rounded-full bg-surface",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="relative h-full w-full flex-1 rounded-full bg-accent transition-transform duration-[400ms] ease-out"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 rounded-full bg-white/30"
      />
    </ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;
