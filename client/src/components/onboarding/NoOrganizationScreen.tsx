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
import { httpClient } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/store/use-auth-store";
import { showToastOnce } from "@/utils/toast";

type CreateOrganizationPayload = {
  name: string;
};

type JoinOrganizationPayload = {
  joinCode: string;
  role: "STUDENT" | "TEACHER" | "PARENT";
};

export const NoOrganizationScreen = (): React.JSX.Element => {
  const router = useRouter();
  const { syncProfile } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinRole, setJoinRole] = useState<JoinOrganizationPayload["role"]>("STUDENT");
  const [joinRoleLock, setJoinRoleLock] = useState<JoinOrganizationPayload["role"] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem("join_intent");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { joinCode?: string; role?: JoinOrganizationPayload["role"] };
      if (parsed.joinCode) setJoinCode(parsed.joinCode);
      if (parsed.role) {
        setJoinRole(parsed.role);
        setJoinRoleLock(parsed.role);
      }
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
      await httpClient.post<unknown, CreateOrganizationPayload>("/organizations", {
        name: trimmed,
      });
      await syncProfile({ force: true });
      showToastOnce("Organizace je připravena. Vítej v dashboardu!", {
        type: "success",
      });
      setModalOpen(false);
      setOrgName("");
      router.replace("/dashboard");
    } catch (error) {
      setErrorMessage("Nepodařilo se vytvořit organizaci. Zkus to prosím znovu.");
      showToastOnce("Organizaci se nepodařilo vytvořit.", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = joinCode.trim();
    if (!trimmed) {
      setJoinErrorMessage("Zadej prosím kód organizace.");
      return;
    }
    setJoinSubmitting(true);
    setJoinErrorMessage(null);
    try {
      const result = await httpClient.post<{ sessionToken?: string }, JoinOrganizationPayload>(
        "/auth/join",
        {
          joinCode: trimmed,
          role: joinRole,
        },
      );
      if (result?.sessionToken && typeof result.sessionToken === "string") {
        const { setSessionToken } = useAuthStore.getState();
        setSessionToken(result.sessionToken);
      }
      await syncProfile({ force: true });
      showToastOnce("Připojení k organizaci proběhlo úspěšně.", {
        type: "success",
      });
      setJoinModalOpen(false);
      setJoinCode("");
      router.replace("/dashboard");
    } catch (error) {
      setJoinErrorMessage("Nepodařilo se připojit. Zkus to prosím znovu.");
      showToastOnce("Připojení k organizaci se nezdařilo.", { type: "error" });
    } finally {
      setJoinSubmitting(false);
    }
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
                    setJoinRoleLock(null);
                    setJoinRole("STUDENT");
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
        description="Zadej kód od ředitele a vyber roli v organizaci."
        open={joinModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setJoinErrorMessage(null);
          }
          setJoinModalOpen(open);
        }}
      >
        <form onSubmit={handleJoinOrganization} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="join-code">
              Kód organizace
            </label>
            <Input
              id="join-code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="Např. 9f4d0e2c-..."
              disabled={joinSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Role
            </label>
            <Select
              value={joinRole}
              onValueChange={(value) => setJoinRole(value as JoinOrganizationPayload["role"])}
              disabled={joinSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyber roli" />
              </SelectTrigger>
              <SelectContent>
                {(joinRoleLock ? [joinRoleLock] : ["STUDENT", "TEACHER", "PARENT"]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {role === "STUDENT" ? "Student" : role === "TEACHER" ? "Učitel" : "Rodič"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {joinErrorMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              {joinErrorMessage}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setJoinModalOpen(false)}
              disabled={joinSubmitting}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={joinSubmitting || !joinCode.trim()}>
              {joinSubmitting ? "Připojuji…" : "Připojit se"}
            </Button>
          </div>
        </form>
      </BaseModal>
    </>
  );
};
