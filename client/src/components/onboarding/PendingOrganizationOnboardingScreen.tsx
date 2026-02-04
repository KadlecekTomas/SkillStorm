 "use client";

import { Building2, Hourglass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";

export const PendingOrganizationOnboardingScreen = (): React.JSX.Element => {
  const { org } = useAuth();

  const orgName = org?.name ?? "Škola";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl border-slate-200 bg-gradient-to-br from-white via-amber-50/40 to-slate-50 p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Onboarding školy
              </p>
              <h1 className="text-xl font-semibold text-slate-900">
                {orgName} čeká na aktivaci
              </h1>
            </div>
          </div>

          <Alert
            title="Škola byla vytvořena"
            description={
              <>
                <p>
                  Organizace je založená, ale zatím není aktivní. Než bude možné
                  nastavit školní rok a třídy, musí být škola nejprve aktivována
                  správcem nebo v rámci licenčního procesu.
                </p>
                <p className="mt-2">
                  Jakmile bude škola aktivní, automaticky tě přesměrujeme na
                  další krok nastavení.
                </p>
              </>
            }
          />

          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-white/60 px-4 py-3 text-sm text-slate-700">
            <Hourglass className="h-4 w-4 text-amber-500" />
            <p>
              Mezitím můžeš aplikaci procházet v omezeném režimu. Některé akce
              (např. vytvoření školního roku) budou zpřístupněny až po aktivaci
              školy.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

