"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Hourglass, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAppState } from "@/lib/app-state/use-app-state";
import { showToastOnce } from "@/utils/toast";

export const PendingOrganizationOnboardingScreen = (): React.JSX.Element => {
  const router = useRouter();
  const { org, syncProfile } = useAuth();
  const { refresh: refreshAppState } = useAppState();
  const [isChecking, setIsChecking] = useState(false);

  const orgName = org?.name ?? "Škola";

  const handleCheckApproval = async () => {
    setIsChecking(true);
    try {
      const profile = await syncProfile({ force: true });
      await refreshAppState();
      const organization = profile.organization ?? profile.org;
      // Invariant: approval = backend organization.status only. Do not gate on context.mode.
      if (organization?.status === "ACTIVE") {
        router.replace("/app");
        return;
      }
      showToastOnce("Stále čeká na schválení.", { type: "info" });
    } catch {
      showToastOnce("Nepodařilo se ověřit stav. Zkuste to znovu.", {
        type: "error",
      });
    } finally {
      setIsChecking(false);
    }
  };

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
                {orgName} čeká na schválení
              </h1>
            </div>
          </div>

          <InfoAlert
            title="Škola čeká na schválení administrátorem"
            description={
              <>
                <p>
                  Organizace je založená, ale zatím není aktivní. Než bude možné
                  nastavit školní rok a třídy, musí být škola schválena
                  administrátorem.
                </p>
                <p className="mt-2">
                  Po schválení administrátorem klikni na tlačítko „Zkontrolovat
                  stav schválení“ a přesměrujeme tě do aplikace.
                </p>
              </>
            }
          />

          <p className="text-sm font-medium text-slate-700">
            Po schválení školy klikni na tlačítko:
          </p>
          <Button
            onClick={handleCheckApproval}
            disabled={isChecking}
            className="w-full"
          >
            {isChecking ? (
              "Kontroluji…"
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Zkontrolovat stav schválení
              </>
            )}
          </Button>

          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-white/60 px-4 py-3 text-sm text-slate-700">
            <Hourglass className="h-4 w-4 shrink-0 text-amber-500" />
            <p>
              Mezitím můžeš aplikaci procházet v omezeném režimu. Některé akce
              (např. vytvoření školního roku) budou zpřístupněny až po schválení
              školy.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

