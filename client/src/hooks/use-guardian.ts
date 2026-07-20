"use client";

import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";

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
  }[];
  progress: { title: string; submittedAt: string; score: number | null }[];
  messages: never[];
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

export function useGuardianChildren(enabled: boolean) {
  return useQuery<GuardianChildrenData>({
    queryKey: ["guardian", "children"],
    queryFn: () => fetchWithAuth<GuardianChildrenData>("GET", "/guardian/children"),
    enabled,
  });
}

export function useChildOverview(studentId: string | null) {
  return useQuery<ChildOverview>({
    queryKey: ["guardian", "overview", studentId],
    queryFn: () =>
      fetchWithAuth<ChildOverview>(
        "GET",
        `/guardian/children/${studentId}/overview`,
      ),
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
