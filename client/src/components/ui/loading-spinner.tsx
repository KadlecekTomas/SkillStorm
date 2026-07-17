"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

type LoadingSpinnerProps = {
  label?: string;
  fullScreen?: boolean;
  className?: string;
};

export const LoadingSpinner = ({
  label = "Načítám data",
  fullScreen,
  className,
}: LoadingSpinnerProps): React.JSX.Element => (
  <div
    className={cn(
      "flex items-center justify-center gap-3 text-sm text-slate-500",
      fullScreen && "min-h-[40vh]",
      className,
    )}
  >
    <Loader2 className="h-5 w-5 animate-spin text-primary" />
    <span className="font-medium text-slate-600">{label}</span>
  </div>
);
