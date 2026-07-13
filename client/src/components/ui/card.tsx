"use client";

import * as React from "react";
import { cn } from "@/utils/cn";

/*
 * Karty jsou ploché (design reference: .card) — teplý podklad, 1px linka,
 * radius 12 px, žádný stín. `hoverable` přidá ztmavení na surface.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-line bg-canvas-alt p-6 transition-colors",
        hoverable && "hover:border-line-strong hover:bg-surface",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div
    className={cn(
      "mb-4 flex items-start justify-between gap-2 text-ink-muted",
      className,
    )}
    {...props}
  />
);

export const CardTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element => (
  <h3
    className={cn("text-lg font-bold text-ink", className)}
    {...props}
  />
);

export const CardContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div className={cn("space-y-4", className)} {...props} />
);
