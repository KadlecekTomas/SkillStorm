"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BaseModal } from "@/components/modals/base-modal";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionKey } from "@/types";
import { showToastOnce } from "@/utils/toast";

function getApiErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    const data = err.data as { message?: string; meta?: unknown } | undefined;
    return (data?.message as string) ?? err.message ?? "Nepodařilo se provést požadavek.";
  }
  return err instanceof Error ? err.message : "Nepodařilo se provést požadavek.";
}

function isNoActiveAcademicYear(err: unknown): boolean {
  if (!(err instanceof HttpError) || err.status !== 409) return false;
  const data = err.data as { meta?: { code?: string }; code?: string } | undefined;
  const code = data?.meta?.code ?? data?.code;
  return code === "NO_ACTIVE_ACADEMIC_YEAR";
}

type ApiClassroom = {
  id: string;
  label?: string | null;
  grade: string;
  section: string;
  teacher?: { membership?: { user?: { name?: string | null; email?: string | null } } };
  enrollments?: { id: string }[];
  academicYear?: { id: string; label: string; isCurrent: boolean };
};

/**
 * Enrollment data MAY include student.user
 * UI must handle missing user info gracefully
 */
type ClassroomDetail = Omit<ApiClassroom, "enrollments"> & {
  enrollments?: {
    id: string;
    studentId: string;
    student?: {
      membership?: {
        user?: {
          name?: string | null;
        };
      };
    };
  }[];
};

type AcademicYearUIState = "loading" | "empty" | "needs-selection" | "selected";
type ClassroomsDataStatus = "idle" | "loading" | "success" | "error";

const GRADE_OPTIONS = [
  { value: "GRADE_1", label: "1" },
  { value: "GRADE_2", label: "2" },
  { value: "GRADE_3", label: "3" },
  { value: "GRADE_4", label: "4" },
  { value: "GRADE_5", label: "5" },
  { value: "GRADE_6", label: "6" },
  { value: "GRADE_7", label: "7" },
  { value: "GRADE_8", label: "8" },
  { value: "GRADE_9", label: "9" },
];

const gradeLabel = (grade: string) => {
  if (grade.startsWith("GRADE_")) return grade.replace("GRADE_", "");
  if (grade.startsWith("PRIMARY_")) return grade.replace("PRIMARY_", "");
  return grade;
};

export function ClassroomsPageContent(): React.JSX.Element {
  const router = useRouter();
  const {
    years,
    selectedYear,
    selectedYearId,
    isReadOnly,
    status: academicYearStatus,
    yearConfigError,
    bootstrapState,
    setSelectedYearId,
    refresh: refreshYears,
  } = useAcademicYears();
  const { org } = useAuth();
  const { can } = usePermissions();
  const canManageClasses = can(PermissionKey.MANAGE_TEACHERS);
  const canManageEnrollments = can(PermissionKey.MANAGE_STUDENTS);
  const canCreateYear = can(PermissionKey.MANAGE_TEACHERS);

  const [classrooms, setClassrooms] = useState<ApiClassroom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassroomDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ grade: "GRADE_5", section: "", label: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createYearSubmitting, setCreateYearSubmitting] = useState(false);
  const [createYearError, setCreateYearError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"PASTE" | "CSV" | "INVITE" | "EXISTING">("EXISTING");
  const [pasteValue, setPasteValue] = useState("");
  const [csvEntries, setCsvEntries] = useState<Array<{ name: string; email?: string }>>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    enrolled: number;
    createdUsers: number;
    errors: Array<{ index: number; name: string; message: string }>;
  } | null>(null);
  const [origin, setOrigin] = useState("");

  const [availableStudents, setAvailableStudents] = useState<
    { id: string; membership?: { user?: { name?: string | null; email?: string | null } } }[]
  >([]);
  const [availableStudentsLoading, setAvailableStudentsLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [dataStatus, setDataStatus] = useState<ClassroomsDataStatus>("idle");
  const loadClassroomsRef = useRef<AbortController | null>(null);

  const loadClassrooms = useCallback(
    async (bustCache = false): Promise<boolean> => {
      if (bootstrapState !== "READY" || !selectedYearId) {
        setClassrooms([]);
        setSelectedId(null);
        setDataStatus("idle");
        return false;
      }
      loadClassroomsRef.current?.abort();
      loadClassroomsRef.current = new AbortController();
      const ac = loadClassroomsRef.current;
      setDataStatus("loading");
      setLoading(true);
      try {
        const query: Record<string, string> = { yearId: selectedYearId };
        if (bustCache) query._t = String(Date.now());
        const response = await fetchWithAuth<{ data?: ApiClassroom[] } | ApiClassroom[]>("GET", "/classrooms", {
          query,
          signal: ac.signal,
        });
        if (ac.signal.aborted) return false;
        const data = Array.isArray(response) ? response : (response?.data ?? []);
        setClassrooms(data);
        setError(null);
        setDataStatus("success");
        const stillSelected = selectedId && data.some((item: ApiClassroom) => item.id === selectedId);
        if (!stillSelected) {
          setSelectedId(data[0]?.id ?? null);
        }
        return true;
      } catch (err) {
        if (ac.signal.aborted) return false;
        const message = err instanceof Error ? err.message : "Nepodařilo se načíst třídy";
        setError(message);
        setDataStatus("error");
        return false;
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [bootstrapState, selectedYearId, selectedId],
  );

  useEffect(() => {
    if (bootstrapState !== "READY" || !selectedYearId) return;
    void loadClassrooms();
    return () => {
      loadClassroomsRef.current?.abort();
    };
  }, [selectedYearId, bootstrapState, loadClassrooms]);

  const loadDetail = async (classroomId: string) => {
    setDetailLoading(true);
    try {
      const data = await fetchWithAuth<ClassroomDetail>("GET", `/classrooms/${classroomId}`);
      setDetail(data ?? null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId]);

  const summary = useMemo(
    () =>
      classrooms.map((cls) => ({
        ...cls,
        classLabel: cls.label ?? `${gradeLabel(cls.grade)}.${cls.section}`,
        yearLabel: cls.academicYear?.label ?? selectedYear?.name ?? "—",
        displayName: `${cls.label ?? `${gradeLabel(cls.grade)}.${cls.section}`} (${cls.academicYear?.label ?? selectedYear?.name ?? "—"})`,
        teacherName: cls.teacher?.membership?.user?.name ?? "—",
        studentsCount: cls.enrollments?.length ?? 0,
      })),
    [classrooms, selectedYear?.name],
  );

  const selectedSummary = summary.find((item) => item.id === selectedId) ?? null;

  const handleCreateClassroom = async () => {
    if (!selectedYearId) {
      setCreateError("Nejdřív vyber školní rok.");
      showToastOnce("Nejdřív vyber školní rok.", { type: "warning" });
      return;
    }
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const created = await fetchWithAuth<{
        id: string;
        yearId: string;
        grade: string;
        section: string;
        label?: string | null;
      }>("POST", "/classrooms", {
        body: {
          yearId: selectedYearId,
          grade: createForm.grade,
          section: createForm.section.trim(),
          label: createForm.label.trim() || undefined,
        },
      });
      if (!created?.id) {
        throw new Error("Třídu se nepodařilo vytvořit.");
      }
      if (created.yearId !== selectedYearId) {
        setCreateError("Třída byla vytvořena pro jiný školní rok. Obnovuji seznam.");
        showToastOnce("Třída byla vytvořena pro jiný rok.", { type: "warning" });
        await loadClassrooms(true);
        setCreateOpen(false);
        return;
      }
      const optimistic: ApiClassroom = {
        id: created.id,
        grade: created.grade,
        section: created.section,
        label: created.label ?? null,
        enrollments: [],
        ...(selectedYear && {
          academicYear: {
            id: selectedYear.id,
            label: selectedYear.name,
            isCurrent: selectedYear.isActive ?? true,
          },
        }),
      };
      setClassrooms((prev) => [...prev, optimistic].sort(
        (a, b) =>
          String(a.grade).localeCompare(String(b.grade)) ||
          (a.section ?? "").localeCompare(b.section ?? ""),
      ));
      setSelectedId(created.id);
      showToastOnce("Třída vytvořena", { type: "success" });
      setCreateOpen(false);
      setCreateForm({ grade: createForm.grade, section: "", label: "" });
      void loadClassrooms(true);
    } catch (err) {
      if (isNoActiveAcademicYear(err)) {
        setCreateOpen(false);
        showToastOnce("Pro práci s třídami potřebujete aktivní školní rok.", {
          type: "error",
        });
        router.push("/onboarding/academic-year");
        return;
      }
      if (err instanceof HttpError && err.status === 403) {
        const msg = "Nemáte oprávnění vytvářet třídy.";
        setCreateError(msg);
        showToastOnce(msg, { type: "error" });
        return;
      }
      const message = getApiErrorMessage(err);
      setCreateError(message);
      showToastOnce(message, { type: "error" });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleCreateYear = async () => {
    if (process.env.NODE_ENV !== "production" && years.length > 0) {
      throw new Error("AcademicYear creation called while years already exist.");
    }
    setCreateYearSubmitting(true);
    setCreateYearError(null);
    try {
      const now = new Date();
      const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const endYear = startYear + 1;
      const startDate = new Date(`${startYear}-09-01T00:00:00.000Z`);
      const endDate = new Date(`${endYear}-06-30T00:00:00.000Z`);
      const created = await fetchWithAuth<{ id: string }>("POST", "/academic-years", {
        body: {
          name: `${startYear}/${endYear}`,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isActive: true,
        },
      });
      if (!created?.id) {
        throw new Error("Nepodařilo se vytvořit školní rok.");
      }
      await refreshYears();
      setSelectedYearId(created.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nepodařilo se vytvořit školní rok";
      setCreateYearError(message);
    } finally {
      setCreateYearSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!addOpen) return;
    setAddError(null);
    setBulkResult(null);
    setSelectedStudentIds(new Set());
  }, [addOpen]);

  useEffect(() => {
    if (!addOpen || addMode !== "EXISTING" || !selectedId || !selectedYearId) {
      setAvailableStudents([]);
      return;
    }
    setAvailableStudentsLoading(true);
    setAvailableStudents([]);
    fetchWithAuth<{ data: { id: string; membership?: { user?: { name?: string | null; email?: string | null } } }[] }>(
      "GET",
      "/students",
      {
        query: {
          availableForClassSectionId: selectedId,
          availableForYearId: selectedYearId,
          limit: "200",
        },
      }
    )
      .then((res) => setAvailableStudents(res?.data ?? []))
      .catch(() => setAvailableStudents([]))
      .finally(() => setAvailableStudentsLoading(false));
  }, [addOpen, addMode, selectedId, selectedYearId]);

  const parsePasteEntries = (value: string) => {
    return value
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  };

  const parseCsvEntries = (value: string) => {
    const lines = value
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return [] as Array<{ name: string; email?: string }>;

    const normalizeCell = (cell: string) => cell.replace(/^"|"$/g, "").trim();
    const rows = lines.map((line) => line.split(",").map(normalizeCell));
    const header = rows[0]?.map((cell) => cell.toLowerCase()) ?? [];
    const hasHeader = header.includes("name") || header.includes("email");

    const nameIndex = hasHeader ? header.indexOf("name") : 0;
    const emailIndex = hasHeader ? header.indexOf("email") : 1;

    const dataRows = hasHeader ? rows.slice(1) : rows;
    return dataRows
      .map((cols) => ({
        name: (cols[nameIndex] ?? "").trim(),
        email: (cols[emailIndex] ?? "").trim(),
      }))
      .map((entry) => ({
        name: entry.name,
        ...(entry.email ? { email: entry.email } : {}),
      }))
      .filter((entry) => entry.name.length > 0);
  };

  const handleCsvFile = async (file: File | null) => {
    if (!file) {
      setCsvEntries([]);
      setCsvFileName(null);
      return;
    }
    const text = await file.text();
    const entries = parseCsvEntries(text);
    setCsvEntries(entries);
    setCsvFileName(file.name);
  };

  const handleEnrollExisting = async () => {
    if (!selectedId || !selectedYearId) {
      setAddError("Nejdřív vyber třídu a školní rok.");
      return;
    }
    if (selectedStudentIds.size === 0) {
      setAddError("Vyber alespoň jednoho studenta.");
      return;
    }
    if (isReadOnly) {
      setAddError("Do minulého roku nelze zapisovat.");
      return;
    }

    setAddSubmitting(true);
    setAddError(null);
    const ids = Array.from(selectedStudentIds);
    const errors: Array<{ index: number; name: string; message: string }> = [];
    let enrolled = 0;

    for (let i = 0; i < ids.length; i++) {
      try {
        await fetchWithAuth("POST", "/enrollments", {
          body: {
            studentId: ids[i],
            classSectionId: selectedId,
            yearId: selectedYearId,
          },
        });
        enrolled++;
      } catch (err) {
        const s = availableStudents.find((x) => x.id === ids[i]);
        const name = s?.membership?.user?.name ?? "Student";
        errors.push({
          index: i,
          name,
          message: err instanceof Error ? err.message : "Nepodařilo se zapsat.",
        });
      }
    }

    setBulkResult({ enrolled, createdUsers: 0, errors });
    await loadDetail(selectedId);
    void loadClassrooms(true);

    if (errors.length === 0) {
      setAddOpen(false);
      setSelectedStudentIds(new Set());
      showToastOnce(`${enrolled} žáků zapsáno.`, { type: "success" });
    }
    setAddSubmitting(false);
  };

  const handleBulkEnroll = async () => {
    if (!selectedId) {
      setAddError("Nejdřív vyber třídu.");
      return;
    }
    if (!selectedYearId) {
      setAddError("Nejdřív vyber školní rok.");
      return;
    }
    if (isReadOnly) {
      setAddError("Do minulého roku nelze zapisovat.");
      return;
    }

    if (addMode === "EXISTING") {
      await handleEnrollExisting();
      return;
    }

    let entries: Array<{ name: string; email?: string }> = [];
    if (addMode === "PASTE") {
      entries = parsePasteEntries(pasteValue);
    } else if (addMode === "CSV") {
      entries = csvEntries;
    }

    if (!entries.length) {
      setAddError("Přidej alespoň jednoho studenta.");
      return;
    }

    setAddSubmitting(true);
    setAddError(null);
    setBulkResult(null);
    try {
      const result = await fetchWithAuth<{
        enrolled: number;
        createdUsers: number;
        errors: Array<{ index: number; name: string; message: string }>;
        results?: Array<{ index: number; name: string; status: string; message?: string }>;
      }>("POST", "/enrollments/bulk", {
        body: { classroomId: selectedId, academicYearId: selectedYearId, entries },
      });

      setBulkResult(result);
      await loadDetail(selectedId);
      await loadClassrooms();

      if (!result.errors.length) {
        setAddOpen(false);
        setPasteValue("");
        setCsvEntries([]);
        setCsvFileName(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nepodařilo se zapsat studenty";
      setAddError(message);
    } finally {
      setAddSubmitting(false);
    }
  };

  const inviteCode = org?.id ?? "";
  const inviteLink =
    org?.id && origin
      ? `${origin}/register?mode=JOIN_ORG&code=${org.id}&role=STUDENT`
      : "";

  const copyToClipboard = async (value: string, message: string) => {
    if (!value || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(value);
      showToastOnce(message, { type: "success" });
    } catch {
      showToastOnce("Nepodařilo se zkopírovat.", { type: "warning" });
    }
  };

  const yearUiState: AcademicYearUIState =
    academicYearStatus !== "ready"
      ? "loading"
      : years.length === 0
        ? "empty"
        : selectedYearId
          ? "selected"
          : "needs-selection";
  const hasYear = yearUiState === "selected";
  const isInitializingYear = yearUiState === "loading";
  const emptyState = hasYear && dataStatus === "success" && summary.length === 0;
  const needsYearSelection = yearUiState === "needs-selection";

  if (process.env.NODE_ENV !== "production" && academicYearStatus === "loading" && years.length === 0) {
    throw new Error("AcademicYear empty UI rendered while data is still loading.");
  }

  if (yearConfigError === "NO_ACTIVE_ACADEMIC_YEAR") {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600">
            Pro práci s třídami potřebujete aktivní školní rok.
          </p>
          {createYearError && (
            <Alert title="Chyba" description={createYearError} variant="warning" />
          )}
          <Button
            className="mt-3"
            onClick={handleCreateYear}
            disabled={createYearSubmitting || !canCreateYear}
          >
            Vytvořit školní rok
          </Button>
        </div>
      </div>
    );
  }

  if (yearConfigError === "MULTIPLE_ACTIVE_ACADEMIC_YEARS") {
    return (
      <div className="space-y-6">
        <Alert
          title="Konflikt školních roků"
          description="V organizaci je více aktivních školních roků. Oprav to v administraci."
          variant="warning"
        />
      </div>
    );
  }

  if (yearConfigError === "ACADEMIC_YEAR_INVARIANT_BROKEN") {
    return (
      <div className="space-y-6">
        <Alert
          title="Chybí aktivní školní rok"
          description="Organizace nemá správně nastavený aktivní školní rok. Kontaktujte správce."
          variant="warning"
        />
      </div>
    );
  }

  if (yearConfigError === "ACTIVE_YEAR_FETCH_FAILED") {
    return (
      <div className="space-y-6">
        <Alert
          title="Nelze načíst aktivní školní rok"
          description="Zkontroluj připojení nebo to zkus znovu."
          variant="warning"
        />
      </div>
    );
  }

  if (bootstrapState === "LOADING") {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600">Načítám aktivní školní rok…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Classrooms</h1>
          <p className="text-sm text-slate-500">
            {selectedYear ? `Školní rok ${selectedYear.name}` : "Vyber školní rok"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {years.length > 0 && (
            <Select
              value={selectedYearId ?? ""}
              onValueChange={(value) => setSelectedYearId(value)}
              disabled={academicYearStatus !== "ready"}
            >
              <SelectTrigger className="w-40 rounded-2xl" aria-label="Academic year">
                <SelectValue placeholder="Školní rok" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                    {!year.isActive ? " · read-only" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isReadOnly && <Badge variant="warning">Read-only</Badge>}
          {canManageClasses && (
            <Button
              data-testid="create-classroom-btn"
              onClick={() => setCreateOpen(true)}
              disabled={!hasYear || isReadOnly || academicYearStatus !== "ready"}
              title={isReadOnly ? "Minulý rok je pouze ke čtení" : undefined}
            >
              Vytvořit třídu
            </Button>
          )}
        </div>
      </div>

      {isInitializingYear && (
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600">Inicializujeme školní rok…</p>
        </div>
      )}

      {yearUiState === "empty" && canCreateYear && (
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600">
            Pro práci s třídami potřebujete školní rok.
          </p>
          {createYearError && (
            <Alert title="Chyba" description={createYearError} variant="warning" />
          )}
          <Button
            className="mt-3"
            onClick={handleCreateYear}
            disabled={createYearSubmitting}
          >
            Vytvořit školní rok
          </Button>
        </div>
      )}

      {yearUiState === "empty" && !canCreateYear && (
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600">
            Pro práci s třídami potřebujete školní rok.
          </p>
          <Button
            className="mt-3"
            onClick={() =>
              showToastOnce("Požádej správce o vytvoření školního roku.", {
                type: "info",
              })
            }
          >
            Požádat správce o vytvoření školního roku
          </Button>
        </div>
      )}

      {needsYearSelection && (
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600">
            Vyber školní rok, se kterým chceš pracovat.
          </p>
        </div>
      )}

      {error && <Alert title="Chyba" description={error} variant="warning" />}

      {dataStatus === "loading" && (
        <Card className="border-slate-200 p-6">
          <p className="text-sm text-slate-600">Načítám třídy…</p>
        </Card>
      )}

      {emptyState && (
        <Card className="border-dashed p-6">
          <p className="text-sm text-slate-600">Zatím žádné třídy – vytvoř první.</p>
        </Card>
      )}

      {dataStatus === "success" && summary.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            {summary.map((cls) => (
              <button
                key={cls.id}
                data-testid={`classroom-item-${cls.id}`}
                className={`w-full rounded-2xl border p-4 text-left transition ${cls.id === selectedId
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                onClick={() => setSelectedId(cls.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{cls.displayName}</p>
                    <p className={`text-sm ${cls.id === selectedId ? "text-white/70" : "text-slate-500"}`}>
                      {cls.teacherName}
                    </p>
                  </div>
                  <Badge variant={cls.id === selectedId ? "neutral" : "info"}>
                    {cls.studentsCount} žáků
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          <Card className="min-h-[320px] p-6">
            {!selectedId && <p className="text-sm text-slate-500">Vyber třídu pro detail.</p>}
            {selectedId && detailLoading && <p className="text-sm text-slate-500">Načítám detail...</p>}
            {selectedId && !detailLoading && detail && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {(detail.label ?? `${gradeLabel(detail.grade)}.${detail.section}`) +
                        ` (${detail.academicYear?.label ?? selectedYear?.name ?? "—"})`}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Třídní učitel: {detail.teacher?.membership?.user?.name ?? "Neuveden"}
                    </p>
                  </div>
                  {canManageEnrollments && (
                    <Button
                      variant="outline"
                      onClick={() => setAddOpen(true)}
                      disabled={isReadOnly}
                      title={isReadOnly ? "Minulý rok je pouze ke čtení" : undefined}
                    >
                      Přidat žáky
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Zapsaní žáci</p>
                  {detail.enrollments && detail.enrollments.length > 0 ? (
                    <div className="space-y-2">
                      {detail.enrollments.map((enrollment) => (
                        <div
                          key={enrollment.id}
                          className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm text-slate-700"
                        >
{enrollment.student
  ? enrollment.student.membership?.user?.name ?? "Neznámý uživatel"
  : "Student nenačten"}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Tato třída zatím nemá zapsané žáky.
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <BaseModal
        title="Nová třída"
        {...(selectedYear ? { description: `Školní rok ${selectedYear.name}` } : {})}
        open={createOpen}
        onOpenChange={setCreateOpen}
      >

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-600">
              Ročník
              <Select
                value={createForm.grade}
                onValueChange={(value) => setCreateForm((prev) => ({ ...prev, grade: value }))}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-sm text-slate-600">
              Sekce
              <Input
                value={createForm.section}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, section: event.target.value.toUpperCase() }))
                }
                placeholder="A"
              />
            </label>
          </div>
          <label className="space-y-1 text-sm text-slate-600">
            Název třídy
            <Input
              value={createForm.label}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, label: event.target.value }))
              }
              placeholder={`${gradeLabel(createForm.grade)}.${createForm.section || "A"}`}
            />
          </label>
          {createError && <Alert title="Chyba" description={createError} variant="warning" />}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Zrušit
            </Button>
            <Button
              onClick={() => void handleCreateClassroom()}
              disabled={!createForm.section.trim() || createSubmitting}
            >
              Vytvořit
            </Button>
          </div>
        </div>
      </BaseModal>

      <BaseModal
        title="Přidat žáky"
        {...(selectedSummary
          ? {
              description: `Třída ${selectedSummary.displayName}`,
            }
          : {})}
        open={addOpen}
        onOpenChange={setAddOpen}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={addMode === "EXISTING" ? "default" : "outline"}
              onClick={() => setAddMode("EXISTING")}
            >
              Vybrat existující
            </Button>
            <Button
              variant={addMode === "PASTE" ? "default" : "outline"}
              onClick={() => setAddMode("PASTE")}
            >
              Vložit jména
            </Button>
            <Button
              variant={addMode === "CSV" ? "default" : "outline"}
              onClick={() => setAddMode("CSV")}
            >
              Nahrát CSV
            </Button>
            <Button
              variant={addMode === "INVITE" ? "default" : "outline"}
              onClick={() => setAddMode("INVITE")}
            >
              Invite link
            </Button>
          </div>

          {addMode === "EXISTING" && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Žáci v organizaci, kteří ještě nejsou zapsáni v této třídě.
              </p>
              {availableStudentsLoading ? (
                <p className="text-sm text-slate-500">Načítám…</p>
              ) : availableStudents.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Žádní dostupní žáci. Všechny už mohou být zapsáni.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 p-2">
                  {availableStudents.map((s) => {
                    const name = s.membership?.user?.name ?? s.membership?.user?.email ?? "Student";
                    const checked = selectedStudentIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedStudentIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.id)) next.delete(s.id);
                              else next.add(s.id);
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm text-slate-700">{name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {availableStudents.length > 0 && (
                <p className="text-xs text-slate-500">
                  Vybráno {selectedStudentIds.size} z {availableStudents.length}
                </p>
              )}
            </div>
          )}

          {addMode === "PASTE" && (
            <div className="space-y-2">
              <label className="space-y-1 text-sm text-slate-600">
                Jména studentů (1 řádek = 1 student)
                <Textarea
                  value={pasteValue}
                  onChange={(event) => setPasteValue(event.target.value)}
                  placeholder={"Jan Novák\nAnna Nováková\nPetr Svoboda"}
                />
              </label>
              <p className="text-xs text-slate-500">
                Celkem {parsePasteEntries(pasteValue).length} studentů.
              </p>
            </div>
          )}

          {addMode === "CSV" && (
            <div className="space-y-2">
              <label className="space-y-1 text-sm text-slate-600">
                CSV soubor (sloupce: name, email)
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(event) => void handleCsvFile(event.target.files?.[0] ?? null)}
                />
              </label>
              {csvFileName && (
                <p className="text-xs text-slate-500">
                  Soubor: {csvFileName} · Načteno {csvEntries.length} studentů
                </p>
              )}
              {!csvFileName && (
                <p className="text-xs text-slate-500">
                  Příklad: <span className="font-medium">name,email</span>
                </p>
              )}
            </div>
          )}

          {addMode === "INVITE" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Invite link je nejjednodušší cesta pro rodiče. Studenti se připojí sami.
              </p>
              <label className="space-y-1 text-sm text-slate-600">
                Invite kód
                <Input readOnly value={inviteCode} />
              </label>
              <label className="space-y-1 text-sm text-slate-600">
                Invite odkaz
                <Input readOnly value={inviteLink} />
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void copyToClipboard(inviteCode, "Kód zkopírován.")}
                  disabled={!inviteCode}
                >
                  Zkopírovat kód
                </Button>
                <Button
                  onClick={() => void copyToClipboard(inviteLink, "Odkaz zkopírován.")}
                  disabled={!inviteLink}
                >
                  Zkopírovat odkaz
                </Button>
              </div>
            </div>
          )}

          {addError && <Alert title="Chyba" description={addError} variant="warning" />}
          {bulkResult && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p>
                Zapsáno: {bulkResult.enrolled} · Nově vytvořeno:{" "}
                {bulkResult.createdUsers}
              </p>
              {bulkResult.errors.length > 0 && (
                <div className="mt-2 space-y-1 text-slate-600">
                  {bulkResult.errors.slice(0, 5).map((err, idx) => (
                    <p key={`${err.index}-${idx}`}>
                      {err.name || "Neznámé jméno"} — {err.message}
                    </p>
                  ))}
                  {bulkResult.errors.length > 5 && (
                    <p>+ {bulkResult.errors.length - 5} dalších chyb.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Zrušit
            </Button>
            {addMode !== "INVITE" && (
              <Button
                onClick={() => void handleBulkEnroll()}
                disabled={
                  addSubmitting ||
                  (addMode === "EXISTING" ? selectedStudentIds.size === 0 : false) ||
                  (addMode === "PASTE" ? !parsePasteEntries(pasteValue).length : false) ||
                  (addMode === "CSV" ? !csvEntries.length : false)
                }
              >
                Zapsat
              </Button>
            )}
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
