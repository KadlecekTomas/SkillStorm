"use client";

import { cn } from "@/utils/cn";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton = ({ className, ...props }: SkeletonProps) => (
  <div
    className={cn(
      "animate-pulse rounded-2xl bg-slate-200/80 text-transparent",
      className,
    )}
    {...props}
  />
);
