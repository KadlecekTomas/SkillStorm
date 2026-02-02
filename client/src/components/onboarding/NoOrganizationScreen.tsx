"use client";

import { useEffect, useState } from "react";
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
import { BaseModal } from "@/components/modals/base-modal";
import { fetchWithAuth, httpClient, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/store/use-auth-store";
import { useAcademicYearStore } from "@/store/use-academic-year-store";
import { showToastOnce } from "@/utils/toast";

type CreateOrganizationPayload = {
  name: string;
};

type InvitePreview = {
  type: "ORG_ONLY" | "STUDENT_CLASS";
  organizationId: string;
  organizationName: string;
  role?: string;
  classSectionId?: string;
  yearId?: string;
  classLabel?: string;
  yearLabel?: string;
};

export const NoOrganizationScreen = (): React.JSX.Element => {
  const router = useRouter();
  const { syncProfile } = useAuth();
  const clearOrg = useAcademicYearStore((s) => s.clearOrg);
  const [modalOpen, setModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinStep, setJoinStep] = useState<"code" | "preview" | "confirm">("code");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [joinRole, setJoinRole] = useState<"TEACHER" | "DIRECTOR">("TEACHER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem("join_intent");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { joinCode?: string; role?: string };
      if (parsed.joinCode) setJoinCode(parsed.joinCode);
      setJoinModalOpen(true);
    } catch {
      // ignore malformed intent
    } finally {
      window.sessionStorage.removeItem("join_intent");
    }
  }, []);

  const handleCreateOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = orgName.trim();
    if (!trimmed) {
      setErrorMessage("Zadej prosím název organizace.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const org = await httpClient.post<{ id: string }, CreateOrganizationPayload>("/organizations", {
        name: trimmed,
      });
      await httpClient.post("/auth/use-org", { orgId: org.id });
      await syncProfile({ force: true });
      showToastOnce("Organizace je připravena. Pokračuj nastavením školního roku.", {
        type: "success",
      });
      setModalOpen(false);
      setOrgName("");
      router.replace("/onboarding/academic-year");
    } catch (error) {
      setErrorMessage("Nepodařilo se vytvořit organizaci. Zkus to prosím znovu.");
      showToastOnce("Organizaci se nepodařilo vytvořit.", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreviewInvite = async () => {
    const trimmed = joinCode.trim();
    if (!trimmed) {
      setJoinErrorMessage("Zadej prosím kód pozvánky.");
      return;
    }
    setPreviewLoading(true);
    setJoinErrorMessage(null);
    setPreview(null);
    try {
      const data = await httpClient.get<InvitePreview>(`/invites/preview?code=${encodeURIComponent(trimmed)}`);
      setPreview(data);
      setJoinStep("preview");
    } catch (err) {
      const msg = err instanceof HttpError ? (err.data as { message?: string })?.message ?? err.message : "Pozvánku se nepodařilo načíst.";
      setJoinErrorMessage(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    const trimmed = joinCode.trim();
    if (!trimmed || !preview) return;
    setJoinSubmitting(true);
    setJoinErrorMessage(null);
    try {
      const result = await fetchWithAuth<{
        sessionToken?: string;
        organization?: { id: string };
      }>("POST", "/invites/accept", {
        body: preview.type === "ORG_ONLY" ? { code: trimmed, role: joinRole } : { code: trimmed },
      });
      const token = result?.sessionToken;
      const orgId = (result as { organization?: { id: string } })?.organization?.id ?? preview.organizationId;
      if (token) {
        useAuthStore.getState().setSessionToken(token);
      }
      clearOrg(orgId);
      await syncProfile({ force: true });
      showToastOnce("Připojení proběhlo úspěšně.", { type: "success" });
      setJoinModalOpen(false);
      setJoinCode("");
      setPreview(null);
      setJoinStep("code");
      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof HttpError ? (err.data as { message?: string })?.message ?? err.message : "Připojení se nezdařilo.";
      setJoinErrorMessage(msg);
      showToastOnce(msg, { type: "error" });
    } finally {
      setJoinSubmitting(false);
    }
  };

  const handleJoinBack = () => {
    setJoinStep("code");
    setPreview(null);
    setJoinErrorMessage(null);
  };

  return (
    <>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl space-y-6">
          <Card className="relative overflow-hidden border-slate-200 bg-gradient-to-br from-white via-emerald-50/50 to-slate-50 p-10">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-200/30 blur-2xl" />
            <div className="relative space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Bez školy
                  </p>
                  <h1 className="text-2xl font-semibold text-slate-900">
                    Nejste připojeni ke škole
                  </h1>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Můžeš pokračovat bez školy, nebo založit školu či se připojit
                pomocí kódu od ředitele.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setModalOpen(true)}>
                  Vytvořit organizaci
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setJoinStep("code");
                    setPreview(null);
                    setJoinModalOpen(true);
                  }}
                >
                  Připojit se ke škole
                </Button>
              </div>
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-slate-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vytvořit
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Založ novou školu a nastav její název. Získáš roli OWNER a můžeš
                spravovat školu.
              </p>
            </Card>
            <Card className="border-slate-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Připojit se
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Zadej kód od ředitele a vyber svou roli. Připojení zvládneš bez
                manuálních kroků.
              </p>
            </Card>
          </div>
        </div>
      </div>

      <BaseModal
        title="Vytvořit organizaci"
        description="Zadej název školy nebo organizace, kterou chceš spravovat."
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setErrorMessage(null);
          }
          setModalOpen(open);
        }}
      >
        <form onSubmit={handleCreateOrganization} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="org-name">
              Název organizace
            </label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              placeholder="Např. ZŠ Nová Praha"
              disabled={isSubmitting}
            />
          </div>
          {errorMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              {errorMessage}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={isSubmitting || !orgName.trim()}>
              {isSubmitting ? "Vytvářím…" : "Vytvořit organizaci"}
            </Button>
          </div>
        </form>
      </BaseModal>

      <BaseModal
        title="Připojit se k organizaci"
        description={joinStep === "code" ? "Zadej kód pozvánky od ředitele nebo učitele." : (preview?.organizationName ?? "Zadej kód pozvánky.")}
        open={joinModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setJoinErrorMessage(null);
            setJoinStep("code");
            setPreview(null);
          }
          setJoinModalOpen(open);
        }}
      >
        <div className="space-y-4">
          {joinStep === "code" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="join-code">
                  Kód pozvánky
                </label>
                <Input
                  id="join-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Kód nebo odkaz z pozvánky"
                  disabled={previewLoading}
                />
              </div>
              {joinErrorMessage && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                  {joinErrorMessage}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={() => setJoinModalOpen(false)} disabled={previewLoading}>
                  Zrušit
                </Button>
                <Button onClick={() => void handlePreviewInvite()} disabled={previewLoading || !joinCode.trim()}>
                  {previewLoading ? "Kontroluji…" : "Zkontrolovat"}
                </Button>
              </div>
            </>
          )}

          {joinStep === "preview" && preview && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-medium">{preview.organizationName}</p>
                {preview.type === "STUDENT_CLASS" && (
                  <p className="mt-1 text-slate-600">
                    Třída: {preview.classLabel ?? "—"} · Rok: {preview.yearLabel ?? "—"}
                  </p>
                )}
              </div>
              {preview.type === "ORG_ONLY" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Role</label>
                  <Select value={joinRole} onValueChange={(v) => setJoinRole(v as "TEACHER" | "DIRECTOR")} disabled={joinSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEACHER">Učitel</SelectItem>
                      <SelectItem value="DIRECTOR">Ředitel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {joinErrorMessage && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                  {joinErrorMessage}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={handleJoinBack} disabled={joinSubmitting}>
                  Zpět
                </Button>
                <Button onClick={() => void handleAcceptInvite()} disabled={joinSubmitting}>
                  {joinSubmitting ? "Připojuji…" : "Připojit se"}
                </Button>
              </div>
            </>
          )}
        </div>
      </BaseModal>
    </>
  );
};
