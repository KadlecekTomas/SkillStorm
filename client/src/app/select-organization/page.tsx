"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export default function SelectOrganizationPage(): React.JSX.Element {
  const { user, switchOrganization, isLoading } = useAuth();
  const memberships = user?.memberships ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Aktivní škola
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">
          Vyber, kde chceš pokračovat
        </h1>
        <p className="text-sm text-slate-500">
          Každá škola má vlastní obsah, oprávnění i testy. Vyber jednu pro
          pokračování v dashboardu.
        </p>
      </div>

      <div className="space-y-4">
        {memberships.map((membership) => (
          <Card
            key={membership.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-soft"
          >
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {membership.organization?.name ?? membership.organizationId}
              </p>
              <p className="text-sm text-slate-500">
                Role:{" "}
                <span className="font-medium uppercase">
                  {membership.role}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="success" className="capitalize">
                {membership.role.toLowerCase()}
              </Badge>
              <Button
                onClick={() => switchOrganization(membership.id)}
                disabled={isLoading}
              >
                Použít
              </Button>
            </div>
          </Card>
        ))}
        {!memberships.length && (
          <Card className="rounded-3xl border border-dashed border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-800">
            Tento účet zatím nemá přiřazenou školu. Zkus se znovu přihlásit nebo
            kontaktuj podporu.
          </Card>
        )}
      </div>
    </div>
  );
}
