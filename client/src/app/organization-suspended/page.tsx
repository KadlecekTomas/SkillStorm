"use client";

import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoAlert } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";

/**
 * Canonical suspended screen for organization owners.
 * Route: /organization-suspended
 */
export default function OrganizationSuspendedPage(): React.JSX.Element {
  const { org } = useAuth();
  const reason = (org as { suspensionReason?: string | null } | null)?.suspensionReason ?? null;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl border-slate-200 p-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Organizace je pozastavena
              </h1>
              <p className="text-sm text-slate-600">
                Přístup k aplikaci je dočasně nedostupný.
              </p>
            </div>
          </div>
          <InfoAlert
            title="Co to znamená"
            description={
              <>
                <p>
                  Vaše škola byla pozastavena správcem platformy. Pro obnovení
                  přístupu kontaktujte podporu nebo správce.
                </p>
                {reason && (
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold">Důvod: </span>
                    {reason}
                  </p>
                )}
              </>
            }
          />
        </div>
      </Card>
    </div>
  );
}

