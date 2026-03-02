"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ErrorAlert, InfoAlert, WarningAlert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BaseModal } from "@/components/modals/base-modal";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useAuth } from "@/hooks/use-auth";
import { useAvailableStudents } from "@/hooks/use-available-students";
import { useClassroomDetail } from "@/hooks/use-classroom-detail";
import { useClassroomRiskOverview } from "@/hooks/use-classroom-risk-overview";
import { useClassroomSubjectPerformance } from "@/hooks/use-classroom-subject-performance";
import { useClassrooms } from "@/hooks/use-classrooms";
import { useClassSectionOrgSubjects } from "@/hooks/use-class-section-org-subjects";
import { useOrgSubjects, subjectLabel } from "@/hooks/use-org-subjects";
import { useTeachers } from "@/hooks/use-teachers";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionKey } from "@/types";
import { showToastOnce } from "@/utils/toast";
import { isRepairStateClassrooms } from "@/lib/app-state/app-state";
import { ArrowUp, ArrowDown, ChevronDown, ChevronRight, Minus } from "lucide-react";
import { cn } from "@/utils/cn";

function getApiErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    const data = err.data as { message?: string; meta?: unknown } | undefined;
    return (data?.message as string) ?? err.message ?? "Nepodařilo se provést požadavek.";
  }
  return err instanceof Error ? err.message : "Nepodařilo se provést požadavek.";
}

function isNoCurrentAcademicYear(err: unknown): boolean {
  if (!(err instanceof HttpError) || err.status !== 409) return false;
  const data = err.data as { meta?: { code?: string }; code?: string } | undefined;
  const code = data?.meta?.code ?? data?.code;
  return code === "NO_CURRENT_ACADEMIC_YEAR" || code === "NO_ACTIVE_ACADEMIC_YEAR";
}

type AcademicYearUIState = "loading" | "empty" | "needs-selection" | "selected";

function parsePositiveInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

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
  { value: "HIGH_SCHOOL_YEAR_1", label: "S1" },
  { value: "HIGH_SCHOOL_YEAR_2", label: "S2" },
  { value: "HIGH_SCHOOL_YEAR_3", label: "S3" },
  { value: "HIGH_SCHOOL_YEAR_4", label: "S4" },
];

const gradeLabel = (grade: string) => {
  if (grade.startsWith("GRADE_")) return grade.replace("GRADE_", "");
  if (grade.startsWith("PRIMARY_")) return grade.replace("PRIMARY_", "");
  if (grade.startsWith("HIGH_SCHOOL_YEAR_")) return `S${grade.replace("HIGH_SCHOOL_YEAR_", "")}`;
  return grade;
};

type EmptyStateProps = {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <Card className="border-dashed p-6">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <p className="mt-1 text-sm text-slate-600">{description}</p>
    {action && (
      <Button className="mt-4" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </Card>
);

/** Repair state: NOT_READY with classrooms but none in current year. Allowed on /app/classrooms; show banner + single CTA, no spinner. */
function useIsRepairState(org: { readiness?: string | null; bootstrap?: { hasClassrooms?: boolean; hasClassroomsInCurrentYear?: boolean; hasClassroomsInActiveYear?: boolean } | null } | null): boolean {
  return (
    org?.readiness === "NOT_READY" &&
    isRepairStateClassrooms(org?.bootstrap ?? null)
  ) === true;
}

export function ClassroomsPageContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawYear = searchParams.get("year");
  const rawGrade = searchParams.get("grade");
  const rawTeacher = searchParams.get("teacher");
  const rawSearch = searchParams.get("search") ?? "";
  const rawCursor = searchParams.get("cursor");
  const rawDirection = searchParams.get("dir");
  const rawLimit = searchParams.get("limit");
  const highlightId = searchParams.get("highlight");
  const { org, syncProfile, isLoading: authLoading, isAuthenticated, roles } = useAuth();
  const canViewStudentDetail = !roles.includes("STUDENT");
  const isRepairState = useIsRepairState(org);
  const isInitOrg =
    org?.status === "ACTIVE" &&
    org?.readiness === "NOT_READY" &&
    !isRepairState;
  // Always load academic years so first class can be created (do not disable when isInitOrg).
  const {
    years,
    selectedYearId: currentYearId,
    status: academicYearStatus,
    yearConfigError,
    setSelectedYearId,
    refresh: refreshYears,
  } = useAcademicYears({ enabled: true });
  const allowedLimits = useMemo(() => new Set([5, 10, 20, 50]), []);
  const yearIds = useMemo(() => new Set(years.map((year) => year.id)), [years]);
  const parsedLimit = parsePositiveInt(rawLimit);
  const cursor = rawCursor && rawCursor.trim().length > 0 ? rawCursor.trim() : null;
  const direction = rawDirection === "prev" ? "prev" : "next";
  const limit = parsedLimit && allowedLimits.has(parsedLimit) ? parsedLimit : 20;
  const yearFilterId = rawYear ? (yearIds.has(rawYear) ? rawYear : null) : currentYearId ?? null;
  const gradeFilter = rawGrade && rawGrade !== "ALL" ? rawGrade : null;
  const teacherFilter = rawTeacher && rawTeacher !== "ALL" ? rawTeacher : null;
  const searchTerm = rawSearch.trim();
  const selectedYear = useMemo(
    () => (yearFilterId ? years.find((year) => year.id === yearFilterId) ?? null : null),
    [years, yearFilterId],
  );
  const isReadOnly = selectedYear ? !selectedYear.isActive : false;
  const { can } = usePermissions();
  const canManageClasses = can(PermissionKey.MANAGE_TEACHERS);
  const canManageEnrollments = can(PermissionKey.MANAGE_STUDENTS);
  const canCreateYear = can(PermissionKey.MANAGE_TEACHERS);

  const selectedId = highlightId;
  const highlightedCardRef = useRef<HTMLButtonElement | null>(null);

  const [searchInput, setSearchInput] = useState(rawSearch);
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});

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
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);
  const [subjectSearchInput, setSubjectSearchInput] = useState("");
  const [selectedOrgSubjectIds, setSelectedOrgSubjectIds] = useState<Set<string>>(new Set());
  const [subjectSaveError, setSubjectSaveError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const { teachers, loading: teachersLoading } = useTeachers();

  const updateQuery = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const next = params.toString();
      const current = searchParams.toString();
      if (next === current) return;
      router.replace(next ? `/app/classrooms?${next}` : "/app/classrooms");
    },
    [router, searchParams],
  );

  useEffect(() => {
    setSearchInput(rawSearch);
  }, [rawSearch]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch !== searchTerm) {
        updateQuery({
          search: nextSearch || null,
          cursor: null,
          dir: null,
          highlight: null,
        });
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput, searchTerm, updateQuery]);

  useEffect(() => {
    const updates: Record<string, string | null> = {};
    const isValidLimit = parsedLimit !== null && allowedLimits.has(parsedLimit);

    if (!rawLimit || !isValidLimit) updates.limit = String(limit);
    if (rawDirection && rawDirection !== "next" && rawDirection !== "prev") {
      updates.dir = null;
    }
    if (!cursor && rawDirection) {
      updates.dir = null;
    }

    if (!rawYear && currentYearId) {
      updates.year = currentYearId;
    }

    if (rawYear && years.length > 0 && !yearIds.has(rawYear)) {
      updates.year = currentYearId ?? null;
      updates.cursor = null;
      updates.dir = null;
      updates.highlight = null;
    }

    if (Object.keys(updates).length > 0) {
      updateQuery(updates);
    }
  }, [
    rawLimit,
    rawYear,
    parsedLimit,
    allowedLimits,
    rawDirection,
    cursor,
    limit,
    currentYearId,
    years,
    yearIds,
    updateQuery,
  ]);

  useEffect(() => {
    if (yearFilterId) {
      setSelectedYearId(yearFilterId);
    }
  }, [yearFilterId, setSelectedYearId]);
  const classroomsState = useClassrooms({
    isAuthLoading: authLoading,
    isAuthenticated,
    orgStatus: org?.status ?? null,
    orgReadiness: org?.readiness ?? null,
    bootstrap: org?.bootstrap ?? null,
    selectedYearId: yearFilterId,
    grade: gradeFilter,
    search: searchTerm,
    teacherId: teacherFilter,
    cursor,
    direction,
    limit,
  });
  const refetchClassrooms = classroomsState.refetch;
  const classrooms = useMemo(
    () =>
      classroomsState.status === "READY_EMPTY" || classroomsState.status === "READY_WITH_DATA"
        ? classroomsState.classrooms
        : [],
    [classroomsState],
  );
  const selectedInList = selectedId ? classrooms.some((item) => item.id === selectedId) : false;
  const effectiveSelectedId = selectedInList ? selectedId : null;
  const { detail, loading: detailLoading, refetch: refetchDetail } = useClassroomDetail(effectiveSelectedId);
  const {
    subjects: classOrgSubjects,
    loading: classOrgSubjectsLoading,
    saving: classOrgSubjectsSaving,
    error: classOrgSubjectsError,
    attach: attachClassOrgSubjects,
  } = useClassSectionOrgSubjects(effectiveSelectedId, !!effectiveSelectedId);
  const { subjects: orgSubjects, loading: orgSubjectsLoading } = useOrgSubjects();
  const { data: riskOverview, loading: riskOverviewLoading } = useClassroomRiskOverview(
    effectiveSelectedId,
    !!effectiveSelectedId && canViewStudentDetail,
  );
  const { data: subjectPerformance, loading: subjectPerformanceLoading } = useClassroomSubjectPerformance(
    effectiveSelectedId,
    yearFilterId ?? null,
    !!effectiveSelectedId && canViewStudentDetail,
  );
  const { students: availableStudents, loading: availableStudentsLoading } = useAvailableStudents({
    enabled: addOpen && addMode === "EXISTING",
    classSectionId: effectiveSelectedId,
    yearId: yearFilterId,
  });

  useEffect(() => {
    if (!highlightId) return;
    if (classroomsState.status !== "READY_EMPTY" && classroomsState.status !== "READY_WITH_DATA") {
      return;
    }
    if (!classrooms.some((item) => item.id === highlightId)) {
      updateQuery({ highlight: null });
    }
  }, [classrooms, highlightId, classroomsState.status, updateQuery]);

  useEffect(() => {
    if (highlightId && highlightedCardRef.current) {
      highlightedCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightId]);

  const summary = useMemo(
    () =>
      classrooms.map((cls) => ({
        ...cls,
        classLabel: cls.label ?? `${gradeLabel(cls.grade)}.${cls.section}`,
        yearLabel: cls.academicYear?.label ?? selectedYear?.name ?? "—",
        displayName: `${cls.label ?? `${gradeLabel(cls.grade)}.${cls.section}`} (${cls.academicYear?.label ?? selectedYear?.name ?? "—"})`,
        teacherName: cls.teacher?.membership?.user?.name ?? "—",
        studentsCount: cls._count?.enrollments ?? cls.enrollments?.length ?? 0,
      })),
    [classrooms, selectedYear?.name],
  );

  const selectedSummary = summary.find((item) => item.id === effectiveSelectedId) ?? null;
  const visibleClassSubjects = useMemo(
    () => classOrgSubjects.slice(0, 6),
    [classOrgSubjects],
  );
  const hiddenClassSubjectsCount = Math.max(0, classOrgSubjects.length - visibleClassSubjects.length);
  const filteredOrgSubjects = useMemo(() => {
    const term = subjectSearchInput.trim().toLowerCase();
    if (!term) return orgSubjects;
    return orgSubjects.filter((subject) =>
      `${subject.name} ${subject.gradeFrom} ${subject.gradeTo}`
        .toLowerCase()
        .includes(term),
    );
  }, [orgSubjects, subjectSearchInput]);
  const meta =
    classroomsState.status === "READY_EMPTY" || classroomsState.status === "READY_WITH_DATA"
      ? classroomsState.meta
      : {
        limit,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
        prevCursor: null,
      };

  const teacherOptions = useMemo(
    () =>
      teachers
        .map((teacher) => ({
          id: teacher.id,
          label:
            teacher.membership?.user?.name?.trim() ||
            teacher.membership?.user?.email ||
            "Učitel",
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "cs")),
    [teachers],
  );

  const gradeGroups = useMemo(() => {
    const order = new Map(GRADE_OPTIONS.map((option, index) => [option.value, index]));
    const groups = new Map<
      string,
      { grade: string; label: string; classes: typeof summary; studentsCount: number }
    >();
    for (const cls of summary) {
      const grade = cls.grade;
      const label = gradeLabel(grade);
      if (!groups.has(grade)) {
        groups.set(grade, {
          grade,
          label,
          classes: [],
          studentsCount: 0,
        });
      }
      const entry = groups.get(grade);
      if (!entry) continue;
      entry.classes.push(cls);
      entry.studentsCount += cls.studentsCount ?? 0;
    }
    return Array.from(groups.values()).sort((a, b) => {
      const left = order.get(a.grade) ?? 999;
      const right = order.get(b.grade) ?? 999;
      return left - right;
    });
  }, [summary]);

  const hasFilters = !!(gradeFilter || teacherFilter || searchTerm);

  useEffect(() => {
    if (!subjectsModalOpen) return;
    setSelectedOrgSubjectIds(new Set(classOrgSubjects.map((subject) => subject.id)));
    setSubjectSearchInput("");
    setSubjectSaveError(null);
  }, [subjectsModalOpen, classOrgSubjects]);

  const handleClearFilters = () => {
    setSearchInput("");
    updateQuery({
      grade: null,
      teacher: null,
      search: null,
      cursor: null,
      dir: null,
      highlight: null,
    });
  };

  const toggleGrade = (grade: string) => {
    setCollapsedGrades((prev) => ({
      ...prev,
      [grade]: !prev[grade],
    }));
  };

  const handleCreateClassroom = async () => {
    if (!yearFilterId) {
      setCreateError("Nejdřív vyber školní rok.");
      showToastOnce("Nejdřív vyber školní rok.", { type: "warning" });
      return;
    }
    if (createSubmitting) return;
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const created = await fetchWithAuth<{
        id: string;
        yearId: string;
        academicYearId?: string;
        grade: string;
        section: string;
        label?: string | null;
        createdAt?: string;
      }>("POST", "/classrooms", {
        body: {
          yearId: yearFilterId,
          grade: createForm.grade,
          section: createForm.section.trim(),
          label: createForm.label.trim() || undefined,
        },
      });
      if (!created?.id) {
        throw new Error("Třídu se nepodařilo vytvořit.");
      }
      const yearId = created.yearId ?? created.academicYearId;
      if (yearId !== yearFilterId) {
        setCreateError("Třída byla vytvořena pro jiný školní rok. Obnovuji seznam.");
        showToastOnce("Třída byla vytvořena pro jiný rok.", { type: "warning" });
        setCreateOpen(false);
        setCreateSubmitting(false);
        return;
      }
      await syncProfile({ force: true });
      const resolvedLabel =
        (created.label ?? `${gradeLabel(created.grade)}.${created.section ?? ""}`).toLowerCase();
      const matchesFilters =
        yearId === yearFilterId &&
        (!gradeFilter || created.grade === gradeFilter) &&
        !teacherFilter &&
        (!searchTerm || resolvedLabel.includes(searchTerm.toLowerCase()));

      if (matchesFilters) {
        if (cursor) {
          await refetchClassrooms({ bypassCache: true, skipFetch: true });
          updateQuery({ cursor: null, dir: null, highlight: created.id });
        } else {
          updateQuery({ highlight: created.id });
          await refetchClassrooms({ bypassCache: true });
        }
      }

      showToastOnce("Třída vytvořena", { type: "success" });
      setCreateOpen(false);
      setCreateForm({ grade: createForm.grade, section: "", label: "" });
    } catch (err) {
      if (isNoCurrentAcademicYear(err)) {
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
      const created = await fetchWithAuth<{ id: string }>("POST", "/academic-years", {
        body: {
          startYear,
          isActive: true,
        },
      });
      if (!created?.id) {
        throw new Error("Nepodařilo se vytvořit školní rok.");
      }
      await refreshYears();
      updateQuery({ year: created.id, cursor: null, dir: null, highlight: null });
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
    if (!effectiveSelectedId || !yearFilterId) {
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
            classSectionId: effectiveSelectedId,
            yearId: yearFilterId,
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
    await refetchDetail();
    await refetchClassrooms({ bypassCache: true });

    if (errors.length === 0) {
      setAddOpen(false);
      setSelectedStudentIds(new Set());
      showToastOnce(`${enrolled} žáků zapsáno.`, { type: "success" });
    }
    setAddSubmitting(false);
  };

  const handleBulkEnroll = async () => {
    if (!effectiveSelectedId) {
      setAddError("Nejdřív vyber třídu.");
      return;
    }
    if (!yearFilterId) {
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
        body: { classroomId: effectiveSelectedId, academicYearId: yearFilterId, entries },
      });

      setBulkResult(result);
      await refetchDetail();
      await refetchClassrooms({ bypassCache: true });

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

  const handleSaveClassSubjects = async () => {
    if (!effectiveSelectedId) {
      setSubjectSaveError("Nejdřív vyber třídu.");
      return;
    }
    const ids = Array.from(selectedOrgSubjectIds);
    if (ids.length === 0) {
      setSubjectSaveError("Vyber alespoň jeden předmět.");
      return;
    }
    setSubjectSaveError(null);
    try {
      await attachClassOrgSubjects(ids, true);
      showToastOnce("Předměty třídy byly aktualizovány.", { type: "success" });
      setSubjectsModalOpen(false);
    } catch (err) {
      setSubjectSaveError(getApiErrorMessage(err));
    }
  };

  const generateStudentInvite = useCallback(async () => {
    if (!effectiveSelectedId || !yearFilterId) {
      setInviteCode("");
      setInviteError("Nejdřív vyber třídu a školní rok.");
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
          type: "STUDENT_CLASS",
          role: "STUDENT",
          classSectionId: effectiveSelectedId,
          yearId: yearFilterId,
        },
      });
      setInviteCode(invite?.inviteToken ?? invite?.code ?? "");
    } catch (err) {
      setInviteCode("");
      setInviteError(getApiErrorMessage(err));
    } finally {
      setInviteLoading(false);
    }
  }, [effectiveSelectedId, yearFilterId]);

  useEffect(() => {
    if (!addOpen || addMode !== "INVITE") return;
    void generateStudentInvite();
  }, [addOpen, addMode, generateStudentInvite]);

  const inviteLink =
    inviteCode && origin
      ? `${origin}/register?mode=JOIN_ORG&inviteToken=${encodeURIComponent(inviteCode)}`
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
        : yearFilterId
          ? "selected"
          : "needs-selection";
  const hasYear = yearUiState === "selected";
  const isInitializingYear = yearUiState === "loading";
  const emptyState =
    classroomsState.status === "READY_EMPTY" && hasYear && summary.length === 0;
  const emptyStateMessage = hasFilters
    ? "Žádné třídy neodpovídají filtrům."
    : "Zatím nemáte žádné třídy.";
  const needsYearSelection = yearUiState === "needs-selection";

  if (!isInitOrg && process.env.NODE_ENV !== "production" && academicYearStatus === "loading" && years.length === 0) {
    throw new Error("AcademicYear empty UI rendered while data is still loading.");
  }

  if (classroomsState.status === "INIT_ORG") {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Příprava školy"
          description="Pro pokračování je potřeba vytvořit alespoň jednu třídu."
          action={{
            label: "Vytvořit první třídu",
            onClick: () => setCreateOpen(true),
          }}
        />
      </div>
    );
  }

  if (yearConfigError === "NO_CURRENT_ACADEMIC_YEAR" || yearConfigError === "NO_ACTIVE_ACADEMIC_YEAR") {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600">
            Pro práci s třídami potřebujete aktivní školní rok.
          </p>
          {createYearError && (
            <ErrorAlert title="Chyba" description={createYearError} />
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

  if (yearConfigError === "MULTIPLE_CURRENT_ACADEMIC_YEARS" || yearConfigError === "MULTIPLE_ACTIVE_ACADEMIC_YEARS") {
    return (
      <div className="space-y-6">
        <InfoAlert
          title="Konflikt školních roků"
          description="V organizaci je více aktivních školních roků. Oprav to v administraci."
        />
      </div>
    );
  }

  if (yearConfigError === "ACADEMIC_YEAR_INVARIANT_BROKEN") {
    return (
      <div className="space-y-6">
        <InfoAlert
          title="Chybí aktivní školní rok"
          description="Organizace nemá správně nastavený aktivní školní rok. Kontaktujte správce."
        />
      </div>
    );
  }

  if (yearConfigError === "ACTIVE_YEAR_FETCH_FAILED") {
    return (
      <div className="space-y-6">
        <ErrorAlert
          title="Nelze načíst aktivní školní rok"
          description="Zkontroluj připojení nebo to zkus znovu."
        />
      </div>
    );
  }

  if (
    (classroomsState.status === "AUTH_LOADING" ||
      classroomsState.status === "FETCHING") &&
    !isRepairState
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Načítám data…" />
      </div>
    );
  }

  if (classroomsState.status === "ERROR") {
    return (
      <div className="space-y-6">
        <ErrorAlert
          title="Chyba"
          description={classroomsState.error.message}
        />
        <Button variant="outline" onClick={() => void refetchClassrooms({ bypassCache: true })}>
          Zkusit znovu
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isRepairState && (
        <>
          <WarningAlert
            title="Žádná třída není přiřazena k aktivnímu školnímu roku"
          />
          <Button onClick={() => setCreateOpen(true)}>
            Přiřadit třídy ke školnímu roku
          </Button>
        </>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Classrooms</h1>
          <p className="text-sm text-slate-500">
            {selectedYear ? `Školní rok ${selectedYear.name}` : "Vyber školní rok"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {years.length > 0 && (
        <Card className="border-slate-200 p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="space-y-1 text-sm text-slate-600">
              Školní rok
              <Select
                value={yearFilterId ?? ""}
                onValueChange={(value) => {
                  updateQuery({ year: value, cursor: null, dir: null, highlight: null });
                  setSelectedYearId(value);
                }}
                disabled={academicYearStatus !== "ready"}
              >
                <SelectTrigger className="rounded-2xl" aria-label="Academic year">
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
            </label>
            <label className="space-y-1 text-sm text-slate-600">
              Ročník
              <Select
                value={gradeFilter ?? "ALL"}
                onValueChange={(value) =>
                  updateQuery({
                    grade: value === "ALL" ? null : value,
                    cursor: null,
                    dir: null,
                    highlight: null,
                  })
                }
                disabled={!hasYear}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Všechny" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Všechny ročníky</SelectItem>
                  {GRADE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-sm text-slate-600">
              Učitel
              <Select
                value={teacherFilter ?? "ALL"}
                onValueChange={(value) =>
                  updateQuery({
                    teacher: value === "ALL" ? null : value,
                    cursor: null,
                    dir: null,
                    highlight: null,
                  })
                }
                disabled={!hasYear || teachersLoading}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Všichni učitelé" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Všichni učitelé</SelectItem>
                  {teacherOptions.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-sm text-slate-600">
              Hledat
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="5.A, 6.B..."
                disabled={!hasYear}
              />
            </label>
            <label className="space-y-1 text-sm text-slate-600">
              Počet na stránku
              <Select
                value={String(limit)}
                onValueChange={(value) =>
                  updateQuery({ limit: value, cursor: null, dir: null, highlight: null })
                }
                disabled={!hasYear}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              {summary.length === 0 ? "0 tříd" : `Zobrazuji až ${meta.limit} tříd`}
              {meta.hasNextPage ? " · další stránka je k dispozici" : ""}
            </span>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Vyčistit filtry
              </Button>
            )}
          </div>
        </Card>
      )}

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
            <ErrorAlert title="Chyba" description={createYearError} />
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

      {emptyState && (
        <Card className="border-dashed p-6">
          <p className="text-sm text-slate-600">{emptyStateMessage}</p>
        </Card>
      )}

      {classroomsState.status === "READY_WITH_DATA" && summary.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            {gradeGroups.map((group) => {
              const isCollapsed = collapsedGrades[group.grade] ?? false;
              return (
                <Card key={group.grade} className="border-slate-200 p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => toggleGrade(group.grade)}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Ročník {group.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {group.classes.length} tříd
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{group.classes.length} tříd</Badge>
                      <Badge variant="neutral">{group.studentsCount} žáků</Badge>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="mt-3 space-y-2">
                      {group.classes.map((cls) => (
                        <button
                          key={cls.id}
                          ref={cls.id === highlightId ? highlightedCardRef : undefined}
                          data-testid={`classroom-item-${cls.id}`}
                          className={`w-full rounded-2xl border p-3 text-left transition ${cls.id === effectiveSelectedId
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                          onClick={() => updateQuery({ highlight: cls.id })}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-base font-semibold">{cls.classLabel}</p>
                              <p className={`text-xs ${cls.id === effectiveSelectedId ? "text-white/70" : "text-slate-500"}`}>
                                {cls.teacherName}
                              </p>
                            </div>
                            <Badge variant={cls.id === effectiveSelectedId ? "neutral" : "info"}>
                              {cls.studentsCount} žáků
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}

            {(cursor || meta.hasPrevPage || meta.hasNextPage) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <span>
                  {cursor ? "Navigace po stránkách je aktivní" : "První stránka"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!cursor}
                    onClick={() => updateQuery({ cursor: null, dir: null, highlight: null })}
                  >
                    Na začátek
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasPrevPage || !meta.prevCursor}
                    onClick={() =>
                      updateQuery({
                        cursor: meta.prevCursor,
                        dir: "prev",
                        highlight: null,
                      })
                    }
                  >
                    Předchozí
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasNextPage || !meta.nextCursor}
                    onClick={() =>
                      updateQuery({
                        cursor: meta.nextCursor,
                        dir: "next",
                        highlight: null,
                      })
                    }
                  >
                    Další
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Card className="min-h-[320px] p-6">
            {!effectiveSelectedId && (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-slate-500">
                <p className="text-sm">Vyber třídu v seznamu pro zobrazení detailu.</p>
              </div>
            )}
            {effectiveSelectedId && detailLoading && <p className="text-sm text-slate-500">Načítám detail...</p>}
            {effectiveSelectedId && !detailLoading && detail && (
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
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-800">Předměty</h3>
                    {canManageClasses && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubjectsModalOpen(true)}
                        disabled={isReadOnly}
                        title={isReadOnly ? "Minulý rok je pouze ke čtení" : undefined}
                      >
                        Upravit předměty
                      </Button>
                    )}
                  </div>
                  {classOrgSubjectsLoading ? (
                    <p className="text-sm text-slate-500">Načítám předměty…</p>
                  ) : classOrgSubjects.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {visibleClassSubjects.map((subject) => (
                        <Badge key={subject.id} variant="info">
                          {subjectLabel(subject)}
                        </Badge>
                      ))}
                      {hiddenClassSubjectsCount > 0 && (
                        <Badge variant="neutral">+{hiddenClassSubjectsCount} další</Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Třída zatím nemá přiřazené předměty.</p>
                  )}
                </div>

                {canViewStudentDetail && (
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-800">Rizikový přehled</h3>
                    {riskOverviewLoading ? (
                      <p className="text-sm text-slate-500">Načítám přehled…</p>
                    ) : riskOverview && riskOverview.students.length > 0 ? (
                      (() => {
                        const atRisk = riskOverview.students.filter((s) => s.riskLevel !== "NONE");
                        if (atRisk.length === 0) {
                          return (
                            <p className="rounded-2xl border border-slate-100 bg-green-50/80 px-4 py-3 text-sm text-green-800">
                              Všichni žáci jsou aktuálně bez rizika.
                            </p>
                          );
                        }
                        const formatDate = (iso: string | null) =>
                          iso ? new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" }) : "—";
                        return (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full min-w-[420px] text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                  <th className="px-4 py-2 text-left font-medium text-slate-700">Žák</th>
                                  <th className="px-4 py-2 text-right font-medium text-slate-700">Průměr</th>
                                  <th className="px-4 py-2 text-center font-medium text-slate-700">Trend</th>
                                  <th className="px-4 py-2 text-left font-medium text-slate-700">Aktivita</th>
                                  <th className="px-4 py-2 text-center font-medium text-slate-700">Riziko</th>
                                </tr>
                              </thead>
                              <tbody>
                                {riskOverview.students.map((s) => (
                                  <tr key={s.studentId} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-2 font-medium text-slate-900">
                                      {canViewStudentDetail ? (
                                        <Link
                                          href={`/app/students/${s.studentId}`}
                                          className="text-sky-600 hover:text-sky-800 hover:underline"
                                        >
                                          {s.displayName}
                                        </Link>
                                      ) : (
                                        s.displayName
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-right text-slate-700">{s.averageScorePercent.toFixed(1)} %</td>
                                    <td className="px-4 py-2 text-center">
                                      {s.trend === "UP" && <ArrowUp className="inline-block h-4 w-4 text-green-600" aria-label="Vzestup" />}
                                      {s.trend === "DOWN" && <ArrowDown className="inline-block h-4 w-4 text-red-600" aria-label="Pokles" />}
                                      {s.trend === "STABLE" && <Minus className="inline-block h-4 w-4 text-slate-400" aria-label="Stabilní" />}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">{formatDate(s.lastActivityAt)}</td>
                                    <td className="px-4 py-2 text-center">
                                      <Badge
                                        variant="neutral"
                                        className={cn(
                                          s.riskLevel === "NONE" && "bg-green-100 text-green-800 border-green-200",
                                          s.riskLevel === "MEDIUM" && "bg-amber-100 text-amber-800 border-amber-200",
                                          s.riskLevel === "HIGH" && "bg-red-100 text-red-800 border-red-200",
                                        )}
                                      >
                                        {s.riskLevel === "NONE" && "Bez rizika"}
                                        {s.riskLevel === "MEDIUM" && "Střední"}
                                        {s.riskLevel === "HIGH" && "Vysoké"}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()
                    ) : canViewStudentDetail && !riskOverviewLoading ? (
                      <p className="text-sm text-slate-500">Žádná data k zobrazení.</p>
                    ) : null}
                  </div>
                )}

                {canViewStudentDetail && (
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-800">Výkon podle předmětu</h3>
                    {subjectPerformanceLoading ? (
                      <p className="text-sm text-slate-500">Načítám přehled…</p>
                    ) : subjectPerformance && subjectPerformance.subjects.length > 0 ? (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full min-w-[400px] text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                              <th className="px-4 py-2 text-left font-medium text-slate-700">Předmět</th>
                              <th className="px-4 py-2 text-right font-medium text-slate-700">Průměr</th>
                              <th className="px-4 py-2 text-right font-medium text-slate-700">Testy</th>
                              <th className="px-4 py-2 text-right font-medium text-slate-700">Pokusy</th>
                              <th className="px-4 py-2 text-center font-medium text-slate-700">Trend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjectPerformance.subjects.map((s) => (
                              <tr key={s.subjectId} className="border-b border-slate-100 last:border-0">
                                <td className="px-4 py-2 font-medium text-slate-900">
                                  {s.name}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <span
                                    className={cn(
                                      s.averageScorePercent < 60 && "font-medium text-red-600",
                                      s.averageScorePercent >= 60 && s.averageScorePercent <= 75 && "text-amber-600",
                                      s.averageScorePercent > 75 && "text-green-600",
                                    )}
                                  >
                                    {s.averageScorePercent.toFixed(1)} %
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right text-slate-700">{s.testCount}</td>
                                <td className="px-4 py-2 text-right text-slate-700">{s.submissionCount}</td>
                                <td className="px-4 py-2 text-center">
                                  {s.trend === "UP" && <ArrowUp className="inline-block h-4 w-4 text-green-600" aria-label="Vzestup" />}
                                  {s.trend === "DOWN" && <ArrowDown className="inline-block h-4 w-4 text-red-600" aria-label="Pokles" />}
                                  {s.trend === "STABLE" && <Minus className="inline-block h-4 w-4 text-slate-400" aria-label="Stabilní" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : !subjectPerformanceLoading ? (
                      <p className="text-sm text-slate-500">Žádná data k zobrazení (předměty s odevzdanými testy).</p>
                    ) : null}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Zapsaní žáci</p>
                  {detail.enrollments && detail.enrollments.length > 0 ? (
                    <div className="space-y-2">
                      {detail.enrollments.map((enrollment) => {
                        const name = enrollment.student
                          ? enrollment.student.membership?.user?.name ?? "Neznámý uživatel"
                          : "Student nenačten";
                        return (
                          <div
                            key={enrollment.id}
                            className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm text-slate-700"
                          >
                            {canViewStudentDetail && enrollment.studentId ? (
                              <Link
                                href={`/app/students/${enrollment.studentId}`}
                                className="font-medium text-sky-600 hover:text-sky-800 hover:underline"
                              >
                                {name}
                              </Link>
                            ) : (
                              name
                            )}
                          </div>
                        );
                      })}
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
          {createError && <ErrorAlert title="Chyba" description={createError} />}
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
              {inviteLoading && (
                <p className="text-sm text-slate-500">Generuji pozvánku…</p>
              )}
              {inviteError && (
                <ErrorAlert title="Chyba pozvánky" description={inviteError} />
              )}
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
                  disabled={!inviteCode || inviteLoading}
                >
                  Zkopírovat kód
                </Button>
                <Button
                  onClick={() => void copyToClipboard(inviteLink, "Pozvánka zkopírována.")}
                  disabled={!inviteLink || inviteLoading}
                >
                  Zkopírovat pozvánku
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void generateStudentInvite()}
                  disabled={inviteLoading}
                >
                  Obnovit pozvánku
                </Button>
              </div>
            </div>
          )}

          {addError && <ErrorAlert title="Chyba" description={addError} />}
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

      <BaseModal
        title="Upravit předměty"
        {...(selectedSummary
          ? {
              description: `Třída ${selectedSummary.displayName}`,
            }
          : {})}
        open={subjectsModalOpen}
        onOpenChange={setSubjectsModalOpen}
      >
        <div className="space-y-4">
          <label className="space-y-1 text-sm text-slate-600">
            Hledat předmět
            <Input
              value={subjectSearchInput}
              onChange={(event) => setSubjectSearchInput(event.target.value)}
              placeholder="Matematika, čeština…"
            />
          </label>

          {orgSubjectsLoading ? (
            <p className="text-sm text-slate-500">Načítám předměty organizace…</p>
          ) : filteredOrgSubjects.length === 0 ? (
            <p className="text-sm text-slate-500">Žádné předměty pro tento filtr.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 p-2">
              {filteredOrgSubjects.map((subject) => {
                const checked = selectedOrgSubjectIds.has(subject.id);
                return (
                  <label
                    key={subject.id}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedOrgSubjectIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(subject.id)) next.delete(subject.id);
                          else next.add(subject.id);
                          return next;
                        });
                      }}
                    />
                    <span className="text-sm text-slate-700">{subjectLabel(subject)}</span>
                  </label>
                );
              })}
            </div>
          )}

          {subjectSaveError && <ErrorAlert title="Chyba" description={subjectSaveError} />}
          {!subjectSaveError && classOrgSubjectsError && (
            <ErrorAlert title="Chyba" description={classOrgSubjectsError} />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSubjectsModalOpen(false)}>
              Zrušit
            </Button>
            <Button
              onClick={() => void handleSaveClassSubjects()}
              disabled={classOrgSubjectsSaving}
            >
              {classOrgSubjectsSaving ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
