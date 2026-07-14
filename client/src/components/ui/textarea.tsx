"use client";

import * as React from "react";
import { cn } from "@/utils/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[120px] w-full rounded-lg border border-line bg-canvas px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-dim focus:outline-none focus:ring-2 focus:ring-accent",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
