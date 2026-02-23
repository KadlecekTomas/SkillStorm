"use client";

import { getPasswordStrength, type PasswordStrength } from "@/lib/password-strength";
import { cn } from "@/utils/cn";

const strengthLabel: Record<PasswordStrength, string> = {
  low: "Slabé",
  medium: "Střední",
  strong: "Silné",
};

const strengthColors: Record<PasswordStrength, string> = {
  low: "bg-red-500",
  medium: "bg-amber-500",
  strong: "bg-emerald-500",
};

type PasswordStrengthIndicatorProps = {
  password: string;
  className?: string;
};

export function PasswordStrengthIndicator({
  password,
  className,
}: PasswordStrengthIndicatorProps): React.JSX.Element {
  const strength = getPasswordStrength(password);
  const width = strength === "low" ? "33%" : strength === "medium" ? "66%" : "100%";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full transition-all duration-200", strengthColors[strength])}
          style={{ width }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {strengthLabel[strength]}
      </p>
    </div>
  );
}
