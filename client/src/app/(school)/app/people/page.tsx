"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, GraduationCap, Pencil, ShieldCheck, UserPlus, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BaseModal } from "@/components/modals/base-modal";
import { ErrorAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { fetchWithAuth } from "@/lib/http/client";
import { showToastOnce } from "@/utils/toast";
import { useAuth } from "@/hooks/use-auth";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";

type StaffRole = "OWNER" | "DIRECTOR" | "TEACHER";

type SchoolPerson = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: StaffRole;
  createdAt?: string;
};

type InviteResult = {
  id: string;
  inviteToken?: string;
  code: string;
  expiresAt: string;
};

type EditDraft = { name: string; email: string };

const MANAGEMENT_ROLES: OrganizationRole[] = ["OWNER", "DIRECTOR"];

const ROLE_LABEL: Record<StaffRole, string> = {
  OWNER: "Vlastník",
  DIRECTOR: "Vedení",
  TEACHER: "Učitel",
};

function unwrap<T>(value: T | { data?: T }): T | null {
  if (value && typeof value === "object" && "data" in value) {
    return (value as { data?: T }).data ?? null;
  }
  return value as T;
}

function PeoplePageContent(): React.JSX.Element {
  const { activeRole, user } = useAuth();
  const actorRole = activeRole ?? user?.organizationRole ?? null;
  const [people, setPeople] = useState<SchoolPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteRole, setInviteRole] = useState<"TEACHER" | "DIRECTOR" | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [editing, setEditing] = useState<SchoolPerson | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: "", email: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth<SchoolPerson[] | { data?: SchoolPerson[] }>(
        "GET",
        "/school-people",
      );
      const data = unwrap(response) ?? [];
      setPeople(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lidi ve škole se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const counts = useMemo(
    () => ({
      leadership: people.filter((person) => person.role === "OWNER" || person.role === "DIRECTOR").length,
      teachers: people.filter((person) => person.role === "TEACHER").length,
    }),
    [people],
  );

  const generateInvite = async (role: "TEACHER" | "DIRECTOR") => {
    setInviteRole(role);
    setInviteOpen(true);
    setInvite(null);
    setInviteError(null);
    setInviteLoading(true);
    try {
      const response = await fetchWithAuth<InviteResult | { data?: InviteResult }>("POST", "/invites", {
        body: { type: "ORG_ONLY", role },
      });
      const result = unwrap(response);
      if (!result?.code) throw new Error("Pozvánku se nepodařilo vytvořit.");
      setInvite(result);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Pozvánku se nepodařilo vytvořit.");
    } finally {
      setInviteLoading(false);
    }
  };

  const inviteLink = useMemo(() => {
    if (!invite) return "";
    const token = invite.inviteToken ?? invite.code;
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join?token=${encodeURIComponent(token)}`;
  }, [invite]);

  const copy = async (value: string, message: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToastOnce(message, { type: "success" });
    } catch {
      showToastOnce("Kopírování se nepodařilo.", { type: "error" });
    }
  };

  const openEdit = (person: SchoolPerson) => {
    setEditing(person);
    setEditDraft({ name: person.name ?? "", email: person.email ?? "" });
    setEditError(null);
  };

  const savePerson = async () => {
    if (!editing) return;
    if (editDraft.name.trim().length < 2) {
      setEditError("Jméno musí mít alespoň 2 znaky.");
      return;
    }
    if (!editDraft.email.includes("@")) {
      setEditError("Zadejte platný e-mail.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const response = await fetchWithAuth<SchoolPerson | { data?: SchoolPerson }>(
        "PATCH",
        `/school-people/${editing.membershipId}`,
        { body: { name: editDraft.name.trim(), email: editDraft.email.trim() } },
      );
      const updated = unwrap(response);
      if (updated) {
        setPeople((current) =>
          current.map((person) =>
            person.membershipId === updated.membershipId
              ? { ...person, ...updated }
              : person,
          ),
        );
      } else {
        await loadPeople();
      }
      setEditing(null);
      showToastOnce("Údaje byly uloženy.", { type: "success" });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Údaje se nepodařilo uložit.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Lidé ve škole</h1>
        <p className="mt-1 text-sm text-slate-600">Žáci, učitelé a vedení na jednom místě.</p>
      </header>

      <section className="grid gap-3 xl:grid-cols-3" aria-label="Přidat člověka">
        <Link
          href="/app/classrooms"
          className="group flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">Přidat žáka</span>
            <span className="mt-1 block text-sm text-slate-500">Vyberete třídu a přidáte jednoho nebo více žáků.</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => void generateInvite("TEACHER")}
          className="group flex min-h-28 w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <UserPlus className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">Pozvat učitele</span>
            <span className="mt-1 block text-sm text-slate-500">Vytvoříte bezpečný jednorázový odkaz nebo kód.</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => void generateInvite("DIRECTOR")}
          className="group flex min-h-28 w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">Přidat vedení</span>
            <span className="mt-1 block text-sm text-slate-500">Stejný jednoduchý postup, rovnou s rolí vedení.</span>
          </span>
        </button>
      </section>

      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Učitelé a vedení</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{counts.teachers} učitelů · {counts.leadership} členů vedení</p>
          </div>
          <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
            <Link href="/app/settings/teachers">Přístupy učitelů ke třídám</Link>
          </Button>
        </div>

        {error && <div className="p-5"><ErrorAlert title="Lidi se nepodařilo načíst" description={error} /></div>}

        {loading ? (
          <div className="flex min-h-32 items-center justify-center"><LoadingSpinner /></div>
        ) : !error && people.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Zatím tu není žádný učitel ani člen vedení.</div>
        ) : !error ? (
          <div className="divide-y divide-slate-100">
            {people.map((person) => {
              const canEdit = actorRole === "OWNER" || person.role !== "OWNER";
              return (
                <div key={person.membershipId} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-900">{person.name || "Bez jména"}</p>
                      <Badge variant="secondary">{ROLE_LABEL[person.role]}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">{person.email || "Bez e-mailu"}</p>
                  </div>
                  {canEdit && (
                    <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => openEdit(person)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Upravit
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      <BaseModal
        title={inviteRole === "DIRECTOR" ? "Pozvánka pro vedení" : "Pozvánka pro učitele"}
        description="Pošlete odkaz, nebo nadiktujte krátký kód."
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      >
        {inviteLoading ? (
          <div className="flex min-h-28 items-center justify-center"><LoadingSpinner /></div>
        ) : inviteError ? (
          <ErrorAlert title="Pozvánku se nepodařilo vytvořit" description={inviteError} />
        ) : invite ? (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Kód</span>
              <div className="flex gap-2">
                <Input readOnly value={invite.code} aria-label="Kód pozvánky" />
                <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => void copy(invite.code, "Kód zkopírován.")}>
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Kopírovat kód</span>
                </Button>
              </div>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Odkaz</span>
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} aria-label="Odkaz pozvánky" />
                <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => void copy(inviteLink, "Odkaz zkopírován.")}>
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Kopírovat odkaz</span>
                </Button>
              </div>
            </label>
            <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => inviteRole && void generateInvite(inviteRole)}>
              Vytvořit nový kód
            </Button>
          </div>
        ) : null}
      </BaseModal>

      <BaseModal
        title="Upravit údaje"
        {...(editing ? { description: ROLE_LABEL[editing.role] } : {})}
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
      >
        {editing && (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Jméno a příjmení</span>
              <Input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} aria-label="Jméno zaměstnance" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">E-mail</span>
              <Input type="email" value={editDraft.email} onChange={(event) => setEditDraft((current) => ({ ...current, email: event.target.value }))} aria-label="E-mail zaměstnance" />
            </label>
            {editError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{editError}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(null)} disabled={editSaving}>Zrušit</Button>
              <Button type="button" className="min-h-11" onClick={() => void savePerson()} disabled={editSaving}>
                {editSaving ? "Ukládám…" : "Uložit"}
              </Button>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  );
}

export default withGuard({
  requireRoles: MANAGEMENT_ROLES,
  requireSchoolWorkspace: true,
})(PeoplePageContent);
