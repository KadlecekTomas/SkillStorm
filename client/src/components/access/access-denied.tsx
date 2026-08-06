"use client";

import { ShieldBan } from "lucide-react";
import { ReportIssueButton } from "@/components/support/report-issue-button";

type AccessDeniedProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
};

export const AccessDenied = ({
  title = "Přístup není povolen",
  description = "Pro tuto část aplikace nemáte oprávnění. Pokud očekáváte přístup, odešlete požadavek podpoře.",
  actionLabel = "Nahlásit problém s přístupem",
}: AccessDeniedProps): React.JSX.Element => {
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
      <ReportIssueButton
        label={actionLabel}
        componentContext="access_denied"
        defaultCategory="OTHER"
        defaultMessage={`Problém s přístupem: ${description}`}
      />
    </div>
  );
};
