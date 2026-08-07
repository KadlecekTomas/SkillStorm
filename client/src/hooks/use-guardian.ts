"use client";

import { fetchWithAuth } from "@/lib/http/client";
import { progressApi, type StudentProgressDetail } from "@/lib/progress-api";
import { useQuery, type UseQueryResult } from "@/lib/query-client";

/**
 * Guardian Etapa B — rodičovská data + školní párování.
 * Odpovědi serveru nikdy nenesou XP/level/parťáka (neporušitelný princip 5);
 * hook je jen tenká vrstva, žádné dopočítávání gamifikace na klientu.
 */

export type GuardianChild = {
  relationId: string;
  studentId: string;
  name: string;
  classLabel: string | null;
  permissions: string[];
};

export type GuardianChildrenData = {
  children: GuardianChild[];
  pendingConfirmation: GuardianChild[];
  disputed: { relationId: string }[];
};

export type ChildOverview = {
  student: { id: string; name: string; classLabel: string | null };
  todo: {
    assignmentId: string;
    title: string;
    dueAt: string;
    started: boolean;
    guardianLaunchPolicy: "DISABLED" | "ALLOWED" | "REQUIRE_CHILD_PIN";
  }[];
  progress: { title: string; submittedAt: string; score: number | null }[];
  messages: Array<{
    id: string;
    kind: "COMMENT" | "PRAISE";
    title: string;
    body: string | null;
    occurredAt: string;
    authorName: string | null;
  }>;
  schoolProgress: {
    averageGrade: number | null;
    competencyMasteryPercent: number | null;
    attendanceRate: number | null;
    competencyMap: StudentProgressDetail["competencyMap"];
  } | null;
  nextStep: {
    type: "ASSIGNMENT_DUE";
    assignmentId: string;
    title: string;
    dueAt: string;
  } | null;
};

export type GuardianSlip = {
  studentId: string;
  studentName: string;
  code: string | null;
  token: string;
  expiresAt: string;
};

export type GuardianBulkResult = {
  classSectionId: string;
  classLabel: string;
  slips: GuardianSlip[];
};

export function useGuardianChildren(
  enabled: boolean,
): UseQueryResult<GuardianChildrenData> {
  return useQuery<GuardianChildrenData>({
    queryKey: ["guardian", "children"],
    queryFn: () => fetchWithAuth<GuardianChildrenData>("GET", "/guardian/children"),
    enabled,
  });
}

async function loadChildOverview(studentId: string): Promise<ChildOverview> {
  const [base, school] = await Promise.all([
    fetchWithAuth<Omit<ChildOverview, "messages" | "schoolProgress"> & { messages?: never[] }>(
      "GET",
      `/guardian/children/${studentId}/overview`,
    ),
    progressApi.guardianStudent(studentId),
  ]);

  // A teacher's pedagogical feedback can be a standalone COMMENT/PRAISE or
  // attached directly to an assessment/competency timeline entry. The parent
  // overview must not silently drop that feedback just because its container
  // is a GRADE/COMPETENCY event.
  const messages = school.timeline
    .filter(
      (item) =>
        item.kind === "COMMENT" ||
        item.kind === "PRAISE" ||
        ((item.kind === "GRADE" || item.kind === "COMPETENCY") &&
          Boolean(item.detail?.trim())),
    )
    .map((item) => ({
      id: item.id,
      kind: item.kind === "PRAISE" ? ("PRAISE" as const) : ("COMMENT" as const),
      title:
        item.kind === "PRAISE"
          ? "Pochvala"
          : item.kind === "GRADE" || item.kind === "COMPETENCY"
            ? item.title
            : "Poznámka učitele",
      body: item.detail,
      occurredAt: item.occurredAt,
      authorName: item.authorName,
    }));

  return {
    ...base,
    messages,
    schoolProgress: {
      averageGrade: school.summary.averageGrade,
      competencyMasteryPercent: school.summary.competencyMasteryPercent,
      attendanceRate: school.summary.attendanceRate,
      competencyMap: school.competencyMap,
    },
  };
}

export function useChildOverview(
  studentId: string | null,
): UseQueryResult<ChildOverview> {
  return useQuery<ChildOverview>({
    queryKey: ["guardian", "overview", studentId],
    queryFn: () => {
      if (!studentId) throw new Error("STUDENT_ID_REQUIRED");
      return loadChildOverview(studentId);
    },
    enabled: Boolean(studentId),
  });
}

/** Potvrzovací obrazovka: Ano → VERIFIED, Ne → DISPUTED (řeší škola). */
export async function resolveGuardianRelation(
  relationId: string,
  confirmed: boolean,
): Promise<void> {
  await fetchWithAuth(
    "POST",
    `/guardian/relations/${relationId}/${confirmed ? "confirm" : "dispute"}`,
  );
}

/** Školní strana: kódy pro celou třídu (primární flow, arch lístečků). */
export async function createGuardianCodesForClass(
  classSectionId: string,
): Promise<GuardianBulkResult> {
  return fetchWithAuth<GuardianBulkResult>(
    "POST",
    `/classrooms/${classSectionId}/guardian-invites/bulk`,
  );
}

// ── Guardian Etapa C: žákovské relace („Spustit pro Matěje") ────────────────

export type LearningSessionInfo = {
  id: string;
  expiresAt: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
};

/** Klientský marker běžící relace (sessionStorage) — zdroj pravdy je server. */
export const STUDENT_SESSION_KEY = "ss.guardian.studentSession";

export function readStudentSessionMarker(): LearningSessionInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STUDENT_SESSION_KEY);
    return raw ? (JSON.parse(raw) as LearningSessionInfo) : null;
  } catch {
    return null;
  }
}

/**
 * Vyčištění klientského stavu při vstupu/výstupu žákovského režimu —
 * sourozenci na jednom zařízení nesmí vidět stav toho druhého (STOP #3).
 */
export function clearClientStateForSessionSwitch(): void {
  try {
    window.sessionStorage.clear();
    window.localStorage.clear();
  } catch {
    // storage může být nedostupná (private mode) — server je soudce, UI stav
    // je jen pohodlí
  }
}

/**
 * Spuštění relace: server PŘEPÍŠE auth cookies žákovskými tokeny — po
 * úspěchu je prohlížeč dítětem. Volající pak naviguje na aktivitu.
 */
export async function startStudentSession(input: {
  studentId: string;
  assignmentId: string;
  assistanceDeclared?: boolean;
  pin?: string;
}): Promise<LearningSessionInfo> {
  const data = await fetchWithAuth<{ session: LearningSessionInfo }>(
    "POST",
    "/guardian/student-sessions",
    { body: input },
  );
  clearClientStateForSessionSwitch();
  window.sessionStorage.setItem(
    STUDENT_SESSION_KEY,
    JSON.stringify(data.session),
  );
  return data.session;
}

/** Ukončení relace (dítě i rodič). Cookies maže server; stav čistíme my. */
export async function endStudentSession(sessionId: string): Promise<void> {
  await fetchWithAuth("POST", `/guardian/student-sessions/${sessionId}/end`);
  clearClientStateForSessionSwitch();
}
