"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PermissionKey, type OrgSubjectOption, type Subject, type SubjectLevel } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { subjectLabel } from "@/hooks/use-org-subjects";
import { showToastOnce } from "@/utils/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchWithAuth } from "@/lib/http/client";
import Link from "next/link";
import { ReportIssueButton } from "@/components/support/report-issue-button";

const profileSchema = z.object({
  fullName: z.string().trim().min(3, "Jméno musí mít alespoň 3 znaky."),
  email: z.string().email("Zadejte platnou e-mailovou adresu."),
});

const passwordSchema = z
  .object({
    current: z.string().min(1, "Zadejte současné heslo."),
    next: z
      .string()
      .min(8, "Nové heslo musí mít alespoň 8 znaků.")
      .regex(/[A-Za-z]/, "Nové heslo musí obsahovat alespoň jedno písmeno.")
      .regex(/\d/, "Nové heslo musí obsahovat alespoň jednu číslici."),
    confirm: z.string().min(1, "Potvrďte nové heslo."),
  })
  .refine((data) => data.next === data.confirm, {
    message: "Nové heslo a potvrzení se neshodují.",
    path: ["confirm"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
const GRADE_COLUMNS = ["GRADE_1","GRADE_2","GRADE_3","GRADE_4","GRADE_5","GRADE_6","GRADE_7","GRADE_8","GRADE_9"] as const;

type TopicItem = {
  id: string;
  subjectLevelId: string;
  catalogTopicId: string;
  name: string | null;
  order: number | null;
  phase: string | null;
  catalogTopic: { id: string; name: string } | null;
};

type CatalogTopicOption = {
  id: string;
  name: string;
};

export default function SettingsPage(): React.JSX.Element {
  const { org, user, syncProfile, activeRole } = useAuth();
  const { can } = usePermissions();
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      email: "",
    },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current: "",
      next: "",
      confirm: "",
    },
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      fullName: user.fullName ?? user.name ?? "",
      email: user.email ?? "",
    });
  }, [profileForm, user]);

  const effectiveRole = activeRole ?? user?.organizationRole ?? null;
  const canManagePeople = effectiveRole === "OWNER" || effectiveRole === "DIRECTOR";

  const onProfileSubmit = async (values: ProfileValues) => {
    if (!user?.id) {
      showToastOnce("Účet není načtený. Obnovte stránku a zkuste to znovu.", { type: "error" });
      return;
    }
    setProfileSaving(true);
    try {
      await fetchWithAuth("PATCH", `/users/${user.id}`, {
        body: {
          name: values.fullName.trim(),
          email: values.email.trim(),
        },
      });
      await syncProfile({ force: true });
      showToastOnce("Profil byl uložen.", { type: "success" });
    } catch (error) {
      showToastOnce(
        error instanceof Error ? error.message : "Profil se nepodařilo uložit.",
        { type: "error" },
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const onPasswordSubmit = async (values: PasswordValues) => {
    setPasswordSaving(true);
    try {
      await fetchWithAuth("POST", "/auth/change-password", {
        body: {
          currentPassword: values.current,
          newPassword: values.next,
        },
      });
      passwordForm.reset();
      showToastOnce("Heslo bylo změněno.", { type: "success" });
    } catch (error) {
      showToastOnce(
        error instanceof Error ? error.message : "Heslo se nepodařilo změnit.",
        { type: "error" },
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── Subjects management ──
  const canManageSubjects = useMemo(
    () => can(PermissionKey.MANAGE_TEACHERS),
    [can],
  );
  const [allSubjects, setAllSubjects] = useState<OrgSubjectOption[]>([]);
  const [curriculumSubjectsById, setCurriculumSubjectsById] = useState<Record<string, Subject>>({});
  const [subjectLevelsById, setSubjectLevelsById] = useState<Record<string, SubjectLevel[]>>({});
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [createSubjectLoading, setCreateSubjectLoading] = useState(false);
  const [createSubjectError, setCreateSubjectError] = useState<string | null>(null);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customGradeFrom, setCustomGradeFrom] = useState("1");
  const [customGradeTo, setCustomGradeTo] = useState("9");
  const [selectedTopicSubjectId, setSelectedTopicSubjectId] = useState("");
  const [selectedTopicGrade, setSelectedTopicGrade] = useState("");
  const [subjectTopics, setSubjectTopics] = useState<TopicItem[]>([]);
  const [catalogTopics, setCatalogTopics] = useState<CatalogTopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [catalogTopicsLoading, setCatalogTopicsLoading] = useState(false);
  const [topicMutationLoading, setTopicMutationLoading] = useState(false);
  const [selectedCatalogTopicId, setSelectedCatalogTopicId] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicOrder, setNewTopicOrder] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicDrafts, setTopicDrafts] = useState<Record<string, { name: string; order: string }>>({});

  const loadAllSubjects = useCallback(async () => {
    if (!canManageSubjects) return;
    setSubjectsLoading(true);
    try {
      const [orgSubjectsRes, curriculumRes] = await Promise.all([
        fetchWithAuth<OrgSubjectOption[] | { data: OrgSubjectOption[] }>("GET", "/org-subjects?includeDisabled=true"),
        fetchWithAuth<Subject[] | { data: Subject[] }>("GET", "/subjects?limit=200&includeInactive=true&includeLevels=true"),
      ]);
      const orgSubjects = Array.isArray(orgSubjectsRes)
        ? orgSubjectsRes
        : ((orgSubjectsRes as { data?: OrgSubjectOption[] }).data ?? []);
      const curriculumSubjects = Array.isArray(curriculumRes)
        ? curriculumRes
        : ((curriculumRes as { data?: Subject[] }).data ?? []);
      setAllSubjects(orgSubjects);
      setCurriculumSubjectsById(
        Object.fromEntries(curriculumSubjects.map((subject) => [subject.id, subject])),
      );
      setSubjectLevelsById(
        Object.fromEntries(
          curriculumSubjects.map((subject) => [subject.id, subject.levels ?? []]),
        ),
      );
    } catch {
      showToastOnce("Předměty se nepodařilo načíst.", { type: "error" });
    } finally {
      setSubjectsLoading(false);
    }
  }, [canManageSubjects]);

  useEffect(() => {
    void loadAllSubjects();
  }, [loadAllSubjects]);

  const topicManageableSubjects = useMemo(
    () =>
      allSubjects.filter((subject) => {
        if (!subject.isEnabled) return false;
        const curriculum = curriculumSubjectsById[subject.subject.id];
        return Boolean(curriculum?.catalogSubjectId);
      }),
    [allSubjects, curriculumSubjectsById],
  );

  useEffect(() => {
    if (!topicManageableSubjects.length) {
      setSelectedTopicSubjectId("");
      return;
    }
    if (topicManageableSubjects.some((subject) => subject.subject.id === selectedTopicSubjectId)) {
      return;
    }
    const firstSubject = topicManageableSubjects[0];
    if (firstSubject) {
      setSelectedTopicSubjectId(firstSubject.subject.id);
    }
  }, [selectedTopicSubjectId, topicManageableSubjects]);

  const selectedTopicSubject = curriculumSubjectsById[selectedTopicSubjectId] ?? null;
  const selectedTopicLevels = useMemo(
    () => subjectLevelsById[selectedTopicSubjectId] ?? [],
    [subjectLevelsById, selectedTopicSubjectId],
  );
  const enabledTopicLevels = useMemo(
    () => selectedTopicLevels.filter((level) => level.isEnabled),
    [selectedTopicLevels],
  );
  const selectedSubjectLevel = enabledTopicLevels.find((level) => level.grade === selectedTopicGrade) ?? null;
  const levelGradeById = useMemo(
    () => Object.fromEntries(selectedTopicLevels.map((level) => [level.id, level.grade])),
    [selectedTopicLevels],
  );

  useEffect(() => {
    if (!enabledTopicLevels.length) {
      setSelectedTopicGrade("");
      return;
    }
    if (enabledTopicLevels.some((level) => level.grade === selectedTopicGrade)) {
      return;
    }
    const firstLevel = enabledTopicLevels[0];
    if (firstLevel) {
      setSelectedTopicGrade(firstLevel.grade);
    }
  }, [enabledTopicLevels, selectedTopicGrade]);

  const loadSubjectTopics = useCallback(async (subjectId: string) => {
    if (!subjectId) {
      setSubjectTopics([]);
      return;
    }
    setTopicsLoading(true);
    try {
      const response = await fetchWithAuth<TopicItem[] | { data?: TopicItem[] }>("GET", `/subjects/${subjectId}/topics`);
      const topics = Array.isArray(response)
        ? response
        : ((response as { data?: TopicItem[] }).data ?? []);
      setSubjectTopics(topics);
      setTopicDrafts(
        Object.fromEntries(
          topics.map((topic) => [
            topic.id,
            {
              name: topic.name ?? "",
              order: topic.order == null ? "" : String(topic.order),
            },
          ]),
        ),
      );
    } catch {
      setSubjectTopics([]);
      setTopicDrafts({});
      showToastOnce("Témata se nepodařilo načíst.", { type: "error" });
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTopicSubjectId) {
      setSubjectTopics([]);
      setTopicDrafts({});
      return;
    }
    void loadSubjectTopics(selectedTopicSubjectId);
  }, [loadSubjectTopics, selectedTopicSubjectId]);

  useEffect(() => {
    const catalogSubjectId = selectedTopicSubject?.catalogSubjectId;
    if (!catalogSubjectId) {
      setCatalogTopics([]);
      setSelectedCatalogTopicId("");
      return;
    }
    setCatalogTopicsLoading(true);
    fetchWithAuth<CatalogTopicOption[] | { data?: CatalogTopicOption[] }>("GET", `/topics/catalog/subjects/${catalogSubjectId}/topics`)
      .then((response) => {
        const topics = Array.isArray(response)
          ? response
          : ((response as { data?: CatalogTopicOption[] }).data ?? []);
        setCatalogTopics(topics);
      })
      .catch(() => {
        setCatalogTopics([]);
      })
      .finally(() => setCatalogTopicsLoading(false));
  }, [selectedTopicSubject?.catalogSubjectId]);

  useEffect(() => {
    if (!catalogTopics.length) {
      setSelectedCatalogTopicId("");
      return;
    }
    if (catalogTopics.some((topic) => topic.id === selectedCatalogTopicId)) {
      return;
    }
    const firstTopic = catalogTopics[0];
    if (firstTopic) {
      setSelectedCatalogTopicId(firstTopic.id);
    }
  }, [catalogTopics, selectedCatalogTopicId]);

  const topicsForSelectedGrade = useMemo(
    () =>
      subjectTopics
        .filter((topic) => levelGradeById[topic.subjectLevelId] === selectedTopicGrade)
        .sort((a, b) => {
          const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return (a.catalogTopic?.name ?? a.name ?? "").localeCompare(
            b.catalogTopic?.name ?? b.name ?? "",
            "cs",
          );
        }),
    [levelGradeById, selectedTopicGrade, subjectTopics],
  );

  const handleCreateTopic = async () => {
    if (!selectedSubjectLevel) {
      showToastOnce("Vyber ročník s aktivní osnovou.", { type: "error" });
      return;
    }
    if (!selectedCatalogTopicId) {
      showToastOnce("Vyber katalogové téma.", { type: "error" });
      return;
    }
    const parsedOrder = newTopicOrder.trim() === "" ? undefined : Number(newTopicOrder);
    if (parsedOrder !== undefined && (!Number.isInteger(parsedOrder) || parsedOrder < 0)) {
      showToastOnce("Pořadí musí být nezáporné celé číslo.", { type: "error" });
      return;
    }
    setTopicMutationLoading(true);
    try {
      await fetchWithAuth("POST", "/topics", {
        body: {
          subjectLevelId: selectedSubjectLevel.id,
          catalogTopicId: selectedCatalogTopicId,
          ...(newTopicName.trim() ? { name: newTopicName.trim() } : {}),
          ...(parsedOrder !== undefined ? { order: parsedOrder } : {}),
        },
      });
      setNewTopicName("");
      setNewTopicOrder("");
      await loadSubjectTopics(selectedTopicSubjectId);
      showToastOnce("Téma bylo přidáno.", { type: "success" });
    } catch (e) {
      showToastOnce(e instanceof Error ? e.message : "Téma se nepodařilo přidat.", { type: "error" });
    } finally {
      setTopicMutationLoading(false);
    }
  };

  const handleUpdateTopic = async (topicId: string) => {
    const draft = topicDrafts[topicId];
    if (!draft) return;
    const parsedOrder = draft.order.trim() === "" ? null : Number(draft.order);
    if (parsedOrder !== null && (!Number.isInteger(parsedOrder) || parsedOrder < 0)) {
      showToastOnce("Pořadí musí být nezáporné celé číslo.", { type: "error" });
      return;
    }
    setEditingTopicId(topicId);
    try {
      await fetchWithAuth("PATCH", `/topics/${topicId}`, {
        body: {
          name: draft.name.trim(),
          order: parsedOrder,
        },
      });
      await loadSubjectTopics(selectedTopicSubjectId);
      showToastOnce("Téma bylo upraveno.", { type: "success" });
    } catch (e) {
      showToastOnce(e instanceof Error ? e.message : "Téma se nepodařilo upravit.", { type: "error" });
    } finally {
      setEditingTopicId(null);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    setEditingTopicId(topicId);
    try {
      await fetchWithAuth("DELETE", `/topics/${topicId}`);
      await loadSubjectTopics(selectedTopicSubjectId);
      showToastOnce("Téma bylo smazáno.", { type: "success" });
    } catch (e) {
      showToastOnce(e instanceof Error ? e.message : "Téma se nepodařilo smazat.", { type: "error" });
    } finally {
      setEditingTopicId(null);
    }
  };

  const toggleSubjectActive = async (subject: OrgSubjectOption) => {
    setTogglingId(subject.id);
    try {
      await fetchWithAuth("PATCH", `/org-subjects/${subject.id}`, {
        body: { isEnabled: !subject.isEnabled },
      });
      setAllSubjects((prev) =>
        prev.map((s) => (s.id === subject.id ? { ...s, isEnabled: !s.isEnabled } : s)),
      );
    } catch {
      showToastOnce("Změnu se nepodařilo uložit.", { type: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  const [togglingLevel, setTogglingLevel] = useState<string | null>(null);

  const toggleGradeLevel = async (subject: OrgSubjectOption, grade: string, currentEnabled: boolean) => {
    const subjectId = subject.subject.id;
    const key = `${subjectId}:${grade}`;
    setTogglingLevel(key);
    try {
      await fetchWithAuth("PATCH", `/subjects/${subjectId}/levels/${grade}`, {
        body: { isEnabled: !currentEnabled },
      });
      setSubjectLevelsById((prev) => {
        const nextLevels = [...(prev[subjectId] ?? [])];
        const index = nextLevels.findIndex((level) => level.grade === grade);
        if (index >= 0) {
          const currentLevel = nextLevels[index];
          if (currentLevel) {
            nextLevels[index] = { ...currentLevel, isEnabled: !currentEnabled };
          }
        } else {
          nextLevels.push({
            id: key,
            subjectId,
            grade,
            isEnabled: !currentEnabled,
            order: null,
            label: null,
          });
        }
        return { ...prev, [subjectId]: nextLevels };
      });
    } catch {
      showToastOnce("Změnu osnovy se nepodařilo uložit.", { type: "error" });
    } finally {
      setTogglingLevel(null);
    }
  };

  const handleCreateCustomSubject = async () => {
    if (!org?.id) {
      setCreateSubjectError("Chybí kontext školy.");
      return;
    }
    const name = customSubjectName.trim();
    const gradeFrom = Number(customGradeFrom);
    const gradeTo = Number(customGradeTo);
    if (name.length < 2) {
      setCreateSubjectError("Název předmětu musí mít alespoň 2 znaky.");
      return;
    }
    if (!Number.isInteger(gradeFrom) || !Number.isInteger(gradeTo) || gradeFrom < 1 || gradeTo < 1 || gradeFrom > gradeTo) {
      setCreateSubjectError("Zadejte platný rozsah ročníků.");
      return;
    }
    setCreateSubjectLoading(true);
    setCreateSubjectError(null);
    try {
      await fetchWithAuth("POST", "/org-subjects", {
        body: {
          organizationId: org.id,
          name,
          gradeFrom,
          gradeTo,
          isCustom: true,
          isEnabled: true,
        },
      });
      setCustomSubjectName("");
      setCustomGradeFrom("1");
      setCustomGradeTo("9");
      await loadAllSubjects();
      showToastOnce("Vlastní předmět byl vytvořen.", { type: "success" });
    } catch (e) {
      setCreateSubjectError(e instanceof Error ? e.message : "Předmět se nepodařilo vytvořit.");
    } finally {
      setCreateSubjectLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Profil</h2>
        <p className="mt-1 text-sm text-slate-500">Údaje vašeho účtu používané napříč aplikací.</p>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="mt-4 space-y-4">
          <div>
            <Input placeholder="Celé jméno" autoComplete="name" {...profileForm.register("fullName")} />
            {profileForm.formState.errors.fullName?.message && (
              <p className="mt-1 text-xs text-red-600">{profileForm.formState.errors.fullName.message}</p>
            )}
          </div>
          <div>
            <Input placeholder="E-mail" type="email" autoComplete="email" {...profileForm.register("email")} />
            {profileForm.formState.errors.email?.message && (
              <p className="mt-1 text-xs text-red-600">{profileForm.formState.errors.email.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={profileSaving || !user?.id}>
            {profileSaving ? "Ukládám…" : "Uložit profil"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Zabezpečení</h2>
        <p className="mt-1 text-sm text-slate-500">Změna hesla vyžaduje ověření současného hesla.</p>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="mt-4 space-y-4">
          <Input placeholder="Současné heslo" type="password" autoComplete="current-password" {...passwordForm.register("current")} />
          <div>
            <Input placeholder="Nové heslo" type="password" autoComplete="new-password" {...passwordForm.register("next")} />
            {passwordForm.formState.errors.next?.message && (
              <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.next.message}</p>
            )}
          </div>
          <div>
            <Input placeholder="Potvrzení nového hesla" type="password" autoComplete="new-password" {...passwordForm.register("confirm")} />
            {passwordForm.formState.errors.confirm?.message && (
              <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.confirm.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={passwordSaving}>
            {passwordSaving ? "Měním heslo…" : "Změnit heslo"}
          </Button>
        </form>
      </Card>

      <Card className="md:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Notifikace a GDPR</h2>
            <p className="mt-1 text-sm text-slate-500">
              Preference zatím nejsou napojené na backend. Dokud nejsou skutečně ukládané, nelze je měnit.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Připravujeme</span>
        </div>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-600">Týdenní přehled analytiky</span>
            <Switch disabled aria-label="Týdenní přehled analytiky — připravujeme" />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-600">Připomenutí GDPR exportu</span>
            <Switch disabled aria-label="Připomenutí GDPR exportu — připravujeme" />
          </label>
        </div>
      </Card>

      {canManagePeople && (
        <Card className="md:col-span-2 flex flex-col gap-3 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Lidé ve škole</h3>
            <p className="mt-1 text-sm text-slate-500">
              Přidávání a úpravy žáků, učitelů a vedení jsou na jednom místě.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11 w-full sm:w-fit">
            <Link href="/app/people">Otevřít lidi ve škole</Link>
          </Button>
        </Card>
      )}

      {canManageSubjects && allSubjects.filter((s) => s.isEnabled).length > 0 && (
        <Card className="md:col-span-2 flex flex-col gap-3 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Osnova dle ročníků</h3>
              <p className="text-sm text-slate-500">
                Povolte předměty pro jednotlivé ročníky pro potřeby osnov a plánování výuky. Toto nastavení už neurčuje, pro které ročníky je test platný.
              </p>
            </div>
            <ReportIssueButton
              compact
              label="Nahlásit problém s předměty"
              componentContext="subjects_settings"
              defaultCategory="SUBJECT"
              defaultMessage="Problém s předměty ve škole"
            />
          </div>
          {subjectsLoading ? (
            <p className="text-sm text-slate-500">Načítám…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium whitespace-nowrap">Předmět</th>
                    {GRADE_COLUMNS.map((g) => (
                      <th key={g} className="py-2 px-2 text-center font-medium whitespace-nowrap">
                        {g.replace("GRADE_", "")}. tř.
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allSubjects.filter((s) => s.isEnabled).map((subject) => (
                    <tr key={subject.id} className="hover:bg-slate-50/50">
                      <td className="py-2 pr-4 font-medium text-slate-800 whitespace-nowrap">
                        {subjectLabel(subject)}
                      </td>
                      {GRADE_COLUMNS.map((grade) => {
                        const level = subjectLevelsById[subject.subject.id]?.find((l) => l.grade === grade);
                        const isEnabled = level?.isEnabled ?? false;
                        const key = `${subject.subject.id}:${grade}`;
                        return (
                          <td key={grade} className="py-2 px-2 text-center">
                            <Switch
                              checked={isEnabled}
                              disabled={togglingLevel === key}
                              onCheckedChange={() => void toggleGradeLevel(subject, grade, isEnabled)}
                              aria-label={`${subjectLabel(subject)} – ročník ${grade}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {canManageSubjects && (
        <Card className="md:col-span-2 flex flex-col gap-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Témata předmětů</h3>
            <p className="text-sm text-slate-500">
              Témata se spravují na úrovni předmětu a ročníku. Používají je testy, materiály i zadání přes <code>topicLevelId</code>.
            </p>
          </div>

          {topicManageableSubjects.length === 0 ? (
            <p className="text-sm text-slate-500">
              Pro správu témat nejdřív aktivujte katalogový předmět a ročník v osnově. Vlastní předměty bez napojení na katalog zatím témata nepodporují.
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Předmět</span>
                  <select
                    aria-label="Předmět pro správu témat"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    value={selectedTopicSubjectId}
                    onChange={(event) => setSelectedTopicSubjectId(event.target.value)}
                  >
                    {topicManageableSubjects.map((subject) => (
                      <option key={subject.subject.id} value={subject.subject.id}>
                        {subjectLabel(subject)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Ročník</span>
                  <select
                    aria-label="Ročník pro správu témat"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    value={selectedTopicGrade}
                    onChange={(event) => setSelectedTopicGrade(event.target.value)}
                    disabled={!enabledTopicLevels.length}
                  >
                    {enabledTopicLevels.length === 0 ? (
                      <option value="">Nejdřív povolte ročník v osnově</option>
                    ) : (
                      enabledTopicLevels.map((level) => (
                        <option key={level.id} value={level.grade}>
                          {level.grade.replace("GRADE_", "")}. třída
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_auto]">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Katalogové téma</span>
                  <select
                    aria-label="Katalogové téma"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    value={selectedCatalogTopicId}
                    onChange={(event) => setSelectedCatalogTopicId(event.target.value)}
                    disabled={catalogTopicsLoading || !selectedSubjectLevel}
                  >
                    <option value="">
                      {!selectedSubjectLevel
                        ? "Nejdřív povolte ročník"
                        : catalogTopicsLoading
                          ? "Načítám témata…"
                          : catalogTopics.length === 0
                            ? "Žádná katalogová témata"
                            : "Vyberte téma"}
                    </option>
                    {catalogTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>{topic.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Vlastní název</span>
                  <Input
                    aria-label="Vlastní název tématu"
                    value={newTopicName}
                    onChange={(event) => setNewTopicName(event.target.value)}
                    placeholder="Volitelné přepsání názvu"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Pořadí</span>
                  <Input
                    aria-label="Pořadí tématu"
                    value={newTopicOrder}
                    onChange={(event) => setNewTopicOrder(event.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={() => void handleCreateTopic()}
                    disabled={topicMutationLoading || !selectedSubjectLevel || !selectedCatalogTopicId}
                  >
                    {topicMutationLoading ? "Ukládám…" : "Přidat téma"}
                  </Button>
                </div>
              </div>

              {topicsLoading ? (
                <p className="text-sm text-slate-500">Načítám témata…</p>
              ) : !selectedTopicGrade ? (
                <p className="text-sm text-slate-500">
                  Pro tento předmět ještě není povolen žádný ročník v osnově.
                </p>
              ) : topicsForSelectedGrade.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Pro vybraný ročník zatím nejsou nastavena žádná témata.
                </p>
              ) : (
                <div className="space-y-3">
                  {topicsForSelectedGrade.map((topic) => {
                    const draft = topicDrafts[topic.id] ?? {
                      name: topic.name ?? "",
                      order: topic.order == null ? "" : String(topic.order),
                    };
                    return (
                      <div
                        key={topic.id}
                        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_auto_auto]"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-800">
                            {topic.catalogTopic?.name ?? "Neznámé téma"}
                          </p>
                          <p className="text-xs text-slate-500">Fáze: {topic.phase ?? "INTRO"}</p>
                        </div>
                        <Input
                          value={draft.name}
                          onChange={(event) =>
                            setTopicDrafts((prev) => ({
                              ...prev,
                              [topic.id]: { ...draft, name: event.target.value },
                            }))
                          }
                          placeholder="Vlastní název"
                        />
                        <Input
                          value={draft.order}
                          onChange={(event) =>
                            setTopicDrafts((prev) => ({
                              ...prev,
                              [topic.id]: { ...draft, order: event.target.value },
                            }))
                          }
                          inputMode="numeric"
                          placeholder="Pořadí"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={editingTopicId === topic.id}
                          onClick={() => void handleUpdateTopic(topic.id)}
                        >
                          Uložit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={editingTopicId === topic.id}
                          onClick={() => void handleDeleteTopic(topic.id)}
                        >
                          Smazat
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {canManageSubjects && (
        <Card className="md:col-span-2 flex flex-col gap-3 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Předměty</h3>
            <p className="text-sm text-slate-500">
              Deaktivované předměty nelze použít pro nové testy. Historické testy zůstávají dostupné.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,0.7fr))_auto]">
            <Input
              value={customSubjectName}
              onChange={(e) => setCustomSubjectName(e.target.value)}
              placeholder="Nový vlastní předmět"
            />
            <Input
              value={customGradeFrom}
              onChange={(e) => setCustomGradeFrom(e.target.value)}
              inputMode="numeric"
              placeholder="Od ročníku"
            />
            <Input
              value={customGradeTo}
              onChange={(e) => setCustomGradeTo(e.target.value)}
              inputMode="numeric"
              placeholder="Do ročníku"
            />
            <Button type="button" onClick={() => void handleCreateCustomSubject()} disabled={createSubjectLoading}>
              {createSubjectLoading ? "Vytvářím…" : "Přidat vlastní předmět"}
            </Button>
          </div>
          {createSubjectError && <p className="text-sm text-red-600">{createSubjectError}</p>}

          {subjectsLoading ? (
            <p className="text-sm text-slate-500">Načítám předměty…</p>
          ) : allSubjects.length === 0 ? (
            <p className="text-sm text-slate-400">Žádné předměty.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {allSubjects.map((subject) => (
                <li key={subject.id} className="flex items-center justify-between py-3">
                  <span
                    className={
                      subject.isEnabled
                        ? "text-sm font-medium text-slate-800"
                        : "text-sm text-slate-400 line-through"
                    }
                  >
                    {subjectLabel(subject)}
                    {!subject.isEnabled && (
                      <span className="ml-2 text-xs font-normal no-underline">(deaktivováno)</span>
                    )}
                    {subject.isCustom && (
                      <span className="ml-2 text-xs font-normal text-emerald-700 no-underline">(vlastní)</span>
                    )}
                  </span>
                  <Switch
                    checked={subject.isEnabled}
                    disabled={togglingId === subject.id}
                    onCheckedChange={() => void toggleSubjectActive(subject)}
                    aria-label={subject.isEnabled ? `Deaktivovat ${subjectLabel(subject)}` : `Aktivovat ${subjectLabel(subject)}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
