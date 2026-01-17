"use client";

import { ShieldBan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { audit } from "@/lib/audit/audit.client";

type AccessDeniedProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
};

export const AccessDenied = ({
  title = "Access denied",
  description = "Nemáš oprávnění pro tento modul. Požádej správce organizace o přístup.",
  actionLabel = "Požádat správce",
}: AccessDeniedProps): React.JSX.Element => {
  const handleClick = (): void => {
    audit({
      action: "ACCESS_REQUEST",
      meta: { source: "GuardBoundary", message: description },
    });
  };

  return (
    <div className="flex flex-col items-start gap-4 rounded-3xl border border-dashed border-rose-200 bg-rose-50/80 p-6 text-rose-700">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white text-rose-500 shadow-sm">
          <ShieldBan className="h-6 w-6" />
        </span>
        <div>
          <p className="text-lg font-semibold text-rose-700">{title}</p>
          <p className="text-sm text-rose-600">{description}</p>
        </div>
      </div>
      <Button variant="outline" onClick={handleClick}>
        {actionLabel}
      </Button>
    </div>
  );
};
