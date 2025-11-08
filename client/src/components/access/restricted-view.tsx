"use client";

import { ShieldAlert } from "lucide-react";
import { cn } from "@/utils/cn";

type RestrictedViewProps = {
  title?: string;
  description?: string;
  className?: string;
};

export const RestrictedView = ({
  title = "Omezený přístup",
  description = "Pro zobrazení této sekce potřebuješ dodatečná oprávnění. Obrať se na administrátora organizace.",
  className,
}: RestrictedViewProps) => (
  <div
    className={cn(
      "flex flex-col items-start gap-3 rounded-3xl border border-dashed border-rose-200 bg-rose-50/80 p-6 text-rose-700",
      className,
    )}
  >
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm">
        <ShieldAlert className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide">{title}</p>
        <p className="text-sm text-rose-600">{description}</p>
      </div>
    </div>
  </div>
);
