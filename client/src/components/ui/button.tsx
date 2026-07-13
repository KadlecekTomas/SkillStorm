"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

/*
 * Taktilní tlačítka (design reference: .tactile) — tvrdý spodní stín
 * 0 4px 0 0 <deep barva> a stlačení translateY(2px) při :active.
 * Barvu stínu určuje CSS proměnná --tactile-shadow (viz shadow-tactile
 * v tailwind.config.ts), takže každá varianta nastaví jen svou barvu.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl font-bold transition-all duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-xp disabled:pointer-events-none disabled:opacity-60 gap-2",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white [--tactile-shadow:rgb(var(--accent-deep))] shadow-tactile hover:bg-accent-hover active:translate-y-[2px] active:shadow-tactile-pressed",
        secondary:
          "bg-transparent text-ink border-2 border-line-strong [--tactile-shadow:rgb(var(--line-strong))] shadow-tactile hover:bg-canvas-alt active:translate-y-[2px] active:shadow-tactile-pressed",
        outline:
          "border border-line-strong bg-canvas text-ink font-semibold hover:bg-canvas-alt",
        ghost: "bg-transparent text-ink font-semibold hover:bg-surface",
        destructive:
          "bg-danger text-white [--tactile-shadow:rgb(var(--danger-deep))] shadow-tactile hover:bg-danger-deep active:translate-y-[2px] active:shadow-tactile-pressed focus-visible:outline-danger",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-[15px]",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
