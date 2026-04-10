"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCorrelationId, httpClient, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { showToastOnce } from "@/utils/toast";
import { ORG_OWNER_LIMIT_REACHED } from "@/lib/org-state";
import type { OrganizationType } from "@/types";

const DEFAULT_TYPE: OrganizationType = "SCHOOL";

/** Parse orgId from POST /organizations response (envelope unwrapped or raw). */
function parseOrgId(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const o = res as Record<string, unknown>;
  const data = o.data as Record<string, unknown> | undefined;
  const org = o.organization as Record<string, unknown> | undefined;
  const dataOrg = data?.organization as Record<string, unknown> | undefined;
  const id = o.id ?? data?.id ?? (org && typeof org.id === "string" ? org.id : null) ?? (dataOrg && typeof dataOrg.id === "string" ? dataOrg.id : null);
  return typeof id === "string" ? id : null;
}

function formatCreateOrgError(err: unknown): string {
  if (err instanceof Error && err.message === "USE_ORG_FAILED_OR_BAD_CONTEXT") {
    return "Organizace byla vytvořena, ale nepodařilo se přepnout kontext organizace.";
  }
  if (err instanceof HttpError && err.data && typeof err.data === "object") {
    const d = err.data as { message?: string; code?: string };
    if (d.message) return d.message;
  }
  return err instanceof Error ? err.message : "Nepodařilo se vytvořit organizaci.";
}

export const CreateOrganizationOnboardingScreen = (): React.JSX.Element => {
  const router = useRouter();
  const { syncProfile, hasOrganization, switchToOrganizationByOrgId } = useAuth();
  const [name, setName] = useState("");
  const [type, setType] = useState<OrganizationType>(DEFAULT_TYPE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createRequestKeyRef = useRef<string | null>(null);

  const recoverCreatedOrganization = async (
    fallbackType: OrganizationType,
  ): Promise<boolean> => {
    try {
      const profile = await syncProfile({ force: true });
      const org = profile.organization ?? profile.org ?? null;
      if (!org?.id) return false;
      showToastOnce("Organizace byla vytvořena. Obnovili jsme stav účtu.", {
        type: "info",
      });
      router.replace(fallbackType === "SCHOOL" ? "/onboarding/pending" : "/onboarding/academic-year");
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Zadej prosím název organizace.");
      return;
    }
    if (trimmedName.length < 3) {
      setError("Název organizace musí mít alespoň 3 znaky.");
      return;
    }
    if (hasOrganization) {
      setError("Již máš organizaci. Dokonči nastavení.");
      router.replace("/onboarding/academic-year");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const requestKey =
      createRequestKeyRef.current ?? createCorrelationId();
    createRequestKeyRef.current = requestKey;
    try {
      const res = await httpClient.post<unknown>("/organizations", {
        name: trimmedName,
        type,
      }, {
        headers: {
          "Idempotency-Key": requestKey,
        },
      });
      const orgId = parseOrgId(res);
      if (!orgId) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[onboarding] POST /organizations response shape:", res);
        }
        setError("Organizace byla vytvořena, ale server nevrátil ID. Zkus obnovit stránku.");
        return;
      }

      const newContext = await switchToOrganizationByOrgId(orgId);
      // Contract: redirect and success toast ONLY when context.mode === "organization".
      if (!newContext || newContext.mode !== "organization") {
        if (await recoverCreatedOrganization(type)) {
          return;
        }
        setError("Organizace byla vytvořena, ale nepodařilo se přepnout kontext organizace. Zkus obnovit stránku.");
        return;
      }

      showToastOnce("Organizace byla vytvořena. Dokonči nastavení.", {
        type: "success",
      });
      const effectiveType = (res as { type?: OrganizationType } & Record<string, unknown>)?.type ?? (res as { data?: { type?: OrganizationType } })?.data?.type ?? type;
      router.replace(effectiveType === "SCHOOL" ? "/onboarding/pending" : "/onboarding/academic-year");
    } catch (err) {
      const code =
        err instanceof HttpError && err.data && typeof err.data === "object" && "code" in err.data
          ? (err.data as { code?: string }).code
          : null;
      if (code === ORG_OWNER_LIMIT_REACHED) {
        if (await recoverCreatedOrganization(type)) {
          return;
        }
      }
      if (process.env.NODE_ENV === "development") {
        console.warn("[onboarding] create-org or switch failed:", err);
      }
      setError(formatCreateOrgError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 bg-gradient-to-br from-white via-emerald-50/50 to-slate-50 p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Vytvoření organizace
              </p>
              <h1 className="text-xl font-semibold text-slate-900">
                Zadej název školy
              </h1>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Organizace je základní jednotka v aplikaci. Zadej název školy nebo
            instituce, kterou zakládáš.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="org-name"
              >
                Název organizace
              </label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="např. ZŠ Palackého"
                disabled={isSubmitting}
                required
                minLength={3}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="org-type"
              >
                Typ organizace
              </label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as OrganizationType)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="org-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHOOL">Škola</SelectItem>
                  <SelectItem value="COMMUNITY">Komunita</SelectItem>
                  <SelectItem value="PRIVATE">Soukromá</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                {error}
              </div>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Vytvářím…" : "Vytvořit organizaci"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
