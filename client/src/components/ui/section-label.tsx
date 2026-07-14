import type { JSX, ReactNode } from "react";
import { cn } from "@/utils/cn";

/** Uppercase popisek sekce (design reference: SectionLabel). */
export const SectionLabel = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): JSX.Element => (
  <div
    className={cn(
      "mb-3 text-xs font-bold uppercase tracking-[.08em] text-ink-dim",
      className,
    )}
  >
    {children}
  </div>
);
