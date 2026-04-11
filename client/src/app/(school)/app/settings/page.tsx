"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuccessAlert } from "@/components/ui/alert";
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
  fullName: z.string().min(3),
  email: z.string().email(),
});

const passwordSchema = z
  .object({
    current: z.string().min(6),
    next: z.string().min(6),
    confirm: z.string().min(6),
  })
  .refine((data) => data.next === data.confirm, {
    message: "Passwords must match",
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
  const { hasOrganization, org } = useAuth();
  const { can } = usePermissions();
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "Alex Novak",
      email: "alex@skillstorm.dev",
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
  const [submitted, setSubmitted] = useState(false);
  const [origin, setOrigin] = useState("");
  const [inviteRole, setInviteRole] = useState<"STUDENT" | "TEACHER" | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const canInviteStudents = can(PermissionKey.INVITE_STUDENTS);
  const canInviteTeachers = can(PermissionKey.INVITE_TEACHERS);
  const canInvite = hasOrganization && (canInviteStudents || canInviteTeachers);
  const inviteRoleOptions = useMemo<Array<{ value: "STUDENT" | "TEACHER"; label: string }>>(() => {
    const options: Array<{ value: "STUDENT" | "TEACHER"; label: string }> = [];
    if (canInviteStudents) options.push({ value: "STUDENT", label: "Student" });
    if (canInviteTeachers) options.push({ value: "TEACHER", label: "Teacher" });
    return options;
  }, [canInviteStudents, canInviteTeachers]);

  useEffect(() => {
    if (!inviteRoleOptions.length) {
      setInviteRole(null);
      return;
    }
    const firstOption = inviteRoleOptions[0];
    if (!firstOption) {
      return;
    }
    if (!inviteRole || !inviteRoleOptions.some((opt) => opt.value === inviteRole)) {
      setInviteRole(firstOption.value);
    }
  }, [inviteRole, inviteRoleOptions]);

  const inviteLink = inviteToken && origin
    ? `${origin}/join?token=${encodeURIComponent(inviteToken)}`
    : "";

  const generateInvite = useCallback(async () => {
    if (!inviteRole || !canInvite) {
      setInviteCode("");
      setInviteToken("");
      setInviteError(null);
      return;
    }
    setInviteLoading(true);
    setInviteError(null);
    try {
      const invite = await fetchWithAuth<{
        id: string;
        inviteToken?: string;
        code: string;
        expiresAt: string;
      }>("POST", "/invites", {
        body: {
          type: "ORG_ONLY",
          role: inviteRole,
        },
      });
      setInviteCode(invite?.code ?? "");
      setInviteToken(invite?.inviteToken ?? invite?.code ?? "");
    } catch (e) {
      setInviteCode("");
      setInviteToken("");
      setInviteError(
        e instanceof Error ? e.message : "Pozvánku se nepodařilo vytvořit.",
      );
    } finally {
      setInviteLoading(false);
    }
  }, [canInvite, inviteRole]);

  useEffect(() => {
    if (!canInvite || !inviteRole) return;
    void generateInvite();
  }, [canInvite, inviteRole, generateInvite]);

  const copyToClipboard = async (value: string, message: string) => {
    if (!value) {
      showToastOnce("Nejdřív vyber školu.", { type: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      showToastOnce(message, { type: "success" });
    } catch {
      showToastOnce("Nepodařilo se zkopírovat.", { type: "error" });
    }
  };

  const onProfileSubmit = () => {
    setSubmitted(true);
  };
  const onPasswordSubmit = () => {
    setSubmitted(true);
  };

  // ── Subjects management ──
  const canManageSubjects = can(PermissionKey.MANAGE_TEACHERS);
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
      // silent — subjects section just stays empty
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
  const selectedTopicLevels = subjectLevelsById[selectedTopicSubjectId] ?? [];
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

  // ── Curriculum (SubjectLevel) management ──
  const [togglingLevel, setTogglingLevel] = useState<string | null>(null); // `${subjectId}:${grade}`

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
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="mt-4 space-y-4">
          <Input placeholder="Full name" {...profileForm.register("fullName")} />
          <Input placeholder="Email" type="email" {...profileForm.register("email")} />
          <Button type="submit" className="w-full">
            Save profile
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Security</h2>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="mt-4 space-y-4">
          <Input placeholder="Current password" type="password" {...passwordForm.register("current")} />
          <Input placeholder="New password" type="password" {...passwordForm.register("next")} />
          <Input placeholder="Confirm new password" type="password" {...passwordForm.register("confirm")} />
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
      </Card>

      <Card className="md:col-span-2">
        <h2 className="text-lg font-semibold text-slate-900">Notifications & GDPR</h2>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-600">
              Weekly analytics digest
            </span>
            <Switch defaultChecked />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-600">
              GDPR data export reminders
            </span>
            <Switch />
          </label>
        </div>
      </Card>

      {submitted && (
        <SuccessAlert
          title="Settings updated"
          description="All changes synced with EduTo backend."
        />
      )}

      {canInvite && (
        <Card className="md:col-span-2 flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Invite members
          </h3>
          <p className="text-sm text-slate-600">
            Sdílej kód nebo odkaz s předvybranou rolí.
          </p>
          {inviteLoading && (
            <p className="text-sm text-slate-600">Generuji pozvánku…</p>
          )}
          {inviteError && (
            <p className="text-sm text-red-600">{inviteError}</p>
          )}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Role pozvánky
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  className="min-w-[180px] rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  value={inviteRole ?? ""}
                  onChange={(event) =>
                    setInviteRole(event.target.value as "STUDENT" | "TEACHER")
                  }
                >
                  {inviteRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Invite code
              </label>
              <div className="flex flex-wrap gap-2">
                <Input readOnly value={inviteCode} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(inviteCode, "Kód zkopírován.")}
                  disabled={!inviteCode || inviteLoading}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Invite link
              </label>
              <div className="flex flex-wrap gap-2">
                <Input readOnly value={inviteLink} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(inviteLink, "Pozvánka zkopírována.")}
                  disabled={!inviteLink || inviteLoading}
                >
                  Zkopírovat pozvánku
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void generateInvite()}
                  disabled={inviteLoading || !inviteRole}
                >
                  Obnovit
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {can(PermissionKey.MANAGE_TEACHERS) && (
        <Card className="md:col-span-2 flex flex-col gap-3 rounded-3xl border border-dashed border-blue-200 bg-blue-50/70 p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Manage teachers
          </h3>
          <p className="text-sm text-slate-600">
            Přístup pouze pro ředitele nebo ownera. Umožňuje přidávat a odebírat učitele.
          </p>
          <Button asChild className="w-fit rounded-2xl" variant="outline">
            <Link href="/app/settings/teachers">Open teacher manager</Link>
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
              label="Report issue with subjects"
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
              Témata se spravují na úrovni předmětu a ročníku. Používají je testy, materiály i zadání přes `topicLevelId`.
            </p>
          </div>

          {topicManageableSubjects.length === 0 ? (
            <p className="text-sm text-slate-500">
              Pro správu témat nejdřív aktivuj katalogový předmět a ročník v osnově. Vlastní předměty bez napojení na katalog zatím témata nepodporují.
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
                      <option value="">Nejdřív povol ročník v osnově</option>
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
                        ? "Nejdřív povol ročník"
                        : catalogTopicsLoading
                          ? "Načítám témata…"
                          : catalogTopics.length === 0
                            ? "Žádná katalogová témata"
                            : "Vyber téma"}
                    </option>
                    {catalogTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
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
                          <p className="text-xs text-slate-500">
                            Fáze: {topic.phase ?? "INTRO"}
                          </p>
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
          {createSubjectError && (
            <p className="text-sm text-red-600">{createSubjectError}</p>
          )}

          {subjectsLoading ? (
            <p className="text-sm text-slate-500">Načítám předměty…</p>
          ) : allSubjects.length === 0 ? (
            <p className="text-sm text-slate-400">Žádné předměty.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {allSubjects.map((subject) => (
                <li
                  key={subject.id}
                  className="flex items-center justify-between py-3"
                >
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
