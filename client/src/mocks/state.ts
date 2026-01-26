import { PermissionKey, type User, type OrganizationRole, type OrganizationType } from "@/types";
import { derivePermissions } from "@/utils/permissions";
import type { OrganizationContext } from "@/store/use-auth-store";

export type PolicyQuestion =
  | {
      id: string;
      type: "single";
      prompt: string;
      options: string[];
      correct: string;
    }
  | {
      id: string;
      type: "text";
      prompt: string;
      correct: string;
    }
  | {
      id: string;
      type: "numeric";
      prompt: string;
      correct: number;
    };

export type PolicyTest = {
  id: string;
  orgId: string;
  title: string;
  description: string;
  maxAttempts: number;
  questions: PolicyQuestion[];
};

export type AuthEnvelope = {
  user: User;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
};

export class MockHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type SessionRecord = {
  userId: string | null;
  orgId: string | null;
  force401Once: boolean;
};

const organizations: Record<string, { id: string; name: string; type: OrganizationType }> = {
  "org-a": { id: "org-a", name: "Atlas International", type: "SCHOOL" },
  "org-b": { id: "org-b", name: "Lumen Academy", type: "SCHOOL" },
};

const seedUsers: Record<string, User & { password: string }> = {
  "teacher@atlas.test": {
    id: "user-teacher-a",
    email: "teacher@atlas.test",
    name: "Teacher Atlas",
    organizationId: "org-a",
    organizationRole: "TEACHER",
    password: "password",
    permissions: [],
    memberships: [
      {
        id: "mem-1",
        organizationId: "org-a",
        role: "TEACHER",
        organization: { name: organizations["org-a"]!.name, type: "SCHOOL" },
      },
    ],
  },
  "teacher@lumen.test": {
    id: "user-teacher-b",
    email: "teacher@lumen.test",
    name: "Teacher Lumen",
    organizationId: "org-b",
    organizationRole: "TEACHER",
    password: "password",
    permissions: [],
    memberships: [
      {
        id: "mem-2",
        organizationId: "org-b",
        role: "TEACHER",
        organization: { name: organizations["org-b"]!.name, type: "SCHOOL" },
      },
    ],
  },
  "student@atlas.test": {
    id: "user-student",
    email: "student@atlas.test",
    name: "Student Atlas",
    organizationId: "org-a",
    organizationRole: "STUDENT",
    password: "password",
    permissions: [],
    memberships: [
      {
        id: "mem-3",
        organizationId: "org-a",
        role: "STUDENT",
        organization: { name: organizations["org-a"]!.name, type: "SCHOOL" },
      },
    ],
  },
  "director@atlas.test": {
    id: "user-director",
    email: "director@atlas.test",
    name: "Director Atlas",
    organizationId: "org-a",
    organizationRole: "DIRECTOR",
    password: "password",
    permissions: [],
    memberships: [
      {
        id: "mem-4",
        organizationId: "org-a",
        role: "DIRECTOR",
        organization: { name: organizations["org-a"]!.name, type: "SCHOOL" },
      },
    ],
  },
  "owner@multiorg.test": {
    id: "user-owner",
    email: "owner@multiorg.test",
    name: "Owner MultiOrg",
    organizationId: "org-a",
    organizationRole: "OWNER",
    password: "password",
    permissions: [],
    memberships: [
      {
        id: "mem-5",
        organizationId: "org-a",
        role: "OWNER",
        organization: { name: organizations["org-a"]!.name, type: "SCHOOL" },
      },
      {
        id: "mem-6",
        organizationId: "org-b",
        role: "OWNER",
        organization: { name: organizations["org-b"]!.name, type: "SCHOOL" },
      },
    ],
  },
};

const policyTests: PolicyTest[] = [
  {
    id: "test-algebra-org-a",
    orgId: "org-a",
    title: "Algebra mastery",
    description: "Baseline mastery check for algebra fundamentals.",
    maxAttempts: 2,
    questions: [
      {
        id: "q1",
        type: "single",
        prompt: "Kolik je 3 + 2?",
        options: ["4", "5", "6"],
        correct: "5",
      },
      {
        id: "q2",
        type: "numeric",
        prompt: "Doplň výsledek rovnice 8 - 3",
        correct: 5,
      },
      {
        id: "q3",
        type: "text",
        prompt: "Jak se jmenuje geometrický útvar se třemi stranami?",
        correct: "trojúhelník",
      },
    ],
  },
  {
    id: "test-history-org-b",
    orgId: "org-b",
    title: "World history check",
    description: "Short history comprehension test.",
    maxAttempts: 2,
    questions: [
      {
        id: "q4",
        type: "single",
        prompt: "Kdy začala druhá světová válka?",
        options: ["1937", "1939", "1941"],
        correct: "1939",
      },
    ],
  },
];

const learningMaterials = [
  { id: "material-global", title: "Global climate guide", scope: "GLOBAL" as const, orgId: null },
  { id: "material-org-a", title: "Org A STEM syllabus", scope: "ORGANIZATION" as const, orgId: "org-a" },
  { id: "material-org-b", title: "Org B Language kit", scope: "ORGANIZATION" as const, orgId: "org-b" },
];

const classrooms = [
  { id: "cl-101", label: "Physics Lab A1", grade: "GRADE_9", gradeLabel: "9th", section: "A", teacherName: "Teacher Atlas", studentsCount: 26 },
  { id: "cl-102", label: "Literature Studio", grade: "GRADE_8", gradeLabel: "8th", section: "B", teacherName: "Teacher Atlas", studentsCount: 22 },
];

export const getMockDiagnostics = (): { tests: number; materials: number; classrooms: number } => ({
  tests: policyTests.length,
  materials: learningMaterials.length,
  classrooms: classrooms.length,
});

const analyticsSummary = {
  items: [
    { category: "auth", action: "login", count: 32 },
    { category: "tests", action: "create", count: 12 },
    { category: "submissions", action: "finish", count: 48 },
  ],
};

const gamificationSummary = {
  membershipId: "mem-1",
  xp: 320,
  level: 4,
  nextLevelXp: 400,
  achievements: [
    { id: "ach-1", title: "Test creator", description: "Created 3 tests", iconUrl: "", achievedAt: new Date().toISOString() },
  ],
  events: [
    { id: "evt-1", type: "submission", value: 50, description: "Student completed assessment", createdAt: new Date().toISOString() },
  ],
};

const GLOBAL_TOKEN = "__global__";
const sessionStore = new Map<string, SessionRecord>();
sessionStore.set(GLOBAL_TOKEN, { userId: null, orgId: null, force401Once: false });

const submissions = new Map<string, SubmissionRecord>();
const submissionAttempts = new Map<string, number>();
const auditEvents: AuditEventPayload[] = [];

type SubmissionRecord = {
  id: string;
  userId: string;
  testId: string;
  status: "draft" | "finished";
  answers: Record<string, string>;
  score?: number;
};

type AuditEventPayload = {
  action: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ts: number;
  cid: string;
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createSessionToken = (): string => {
  const token = `sess-${createId()}`;
  sessionStore.set(token, { userId: null, orgId: null, force401Once: false });
  return token;
};

const getSessionRecord = (sessionToken?: string) => {
  const token = sessionToken ?? GLOBAL_TOKEN;
  if (!sessionStore.has(token)) {
    sessionStore.set(token, { userId: null, orgId: null, force401Once: false });
  }
  return sessionStore.get(token)!;
};

const loginEnvelope = (user: User, orgId?: string | null): AuthEnvelope => {
  const activeOrg = orgId ?? user.organizationId ?? null;
  const membership =
    user.memberships?.find((member) => member.organizationId === activeOrg) ??
    user.memberships?.[0];
  const resolvedOrgId = membership?.organizationId ?? null;
  const shapedUser: User = {
    ...user,
    organizationId: resolvedOrgId,
    organizationRole: membership?.role ?? user.organizationRole ?? null,
  };
  const orgRecord = resolvedOrgId ? organizations[resolvedOrgId] : undefined;
  const org =
    resolvedOrgId && orgRecord
      ? { id: resolvedOrgId, name: orgRecord.name, type: orgRecord.type }
      : null;
  const roles = shapedUser.organizationRole ? [shapedUser.organizationRole] : [];
  const basePermissions = derivePermissions(shapedUser);
  return {
    user: shapedUser,
    org,
    roles,
    permissions: basePermissions,
  };
};

const ensureSession = (sessionToken?: string) => {
  const record = getSessionRecord(sessionToken);
  if (record.force401Once) {
    record.force401Once = false;
    throw new MockHttpError(401, "Access token expired");
  }
  if (!record.userId) {
    throw new MockHttpError(401, "Unauthorized");
  }
  const user = Object.values(seedUsers).find((candidate) => candidate.id === record.userId);
  if (!user) {
    throw new MockHttpError(401, "Unauthorized");
  }
  return { user, orgId: record.orgId };
};

const ensureOrgAccess = (requestOrgId: string | null, activeOrgId: string | null) => {
  if (!activeOrgId) {
    throw new MockHttpError(400, "Organization required");
  }
  if (requestOrgId && requestOrgId !== activeOrgId) {
    throw new MockHttpError(403, "Forbidden", {
      permissionKey: PermissionKey.VIEW_RESULTS,
    });
  }
  return activeOrgId;
};

export const resetMockState = (): void => {
  submissions.clear();
  submissionAttempts.clear();
  auditEvents.length = 0;
  sessionStore.forEach((record) => {
    record.userId = null;
    record.orgId = null;
    record.force401Once = false;
  });
};

export const expireTokenOnce = (sessionToken?: string): void => {
  const record = getSessionRecord(sessionToken);
  record.force401Once = true;
};

export const getAuditEventsSnapshot = (): AuditEventPayload[] => [...auditEvents];

export const login = (login: string, password: string, sessionToken?: string): AuthEnvelope => {
  const user = seedUsers[login];
  if (!user || user.password !== password) {
    throw new MockHttpError(401, "Invalid credentials");
  }
  const record = getSessionRecord(sessionToken);
  record.userId = user.id;
  record.orgId = user.organizationId ?? user.memberships?.[0]?.organizationId ?? null;
  record.force401Once = false;
  return loginEnvelope(user);
};

export const logout = (sessionToken?: string): { success: boolean } => {
  const record = getSessionRecord(sessionToken);
  record.userId = null;
  record.orgId = null;
  record.force401Once = false;
  return { success: true };
};

export const refreshSession = (sessionToken?: string): { ok: boolean } => {
  ensureSession(sessionToken);
  return { ok: true };
};

export const getProfile = (sessionToken?: string): AuthEnvelope => {
  const { user, orgId } = ensureSession(sessionToken);
  return loginEnvelope(user, orgId);
};

export const switchOrganization = (orgId: string, sessionToken?: string): AuthEnvelope => {
  const record = getSessionRecord(sessionToken);
  if (!record.userId) {
    throw new MockHttpError(401, "Unauthorized");
  }
  const user = seedUsers[record.userId];
  if (!user) {
    throw new MockHttpError(401, "Unauthorized");
  }
  const membership = user.memberships?.find((member) => member.organizationId === orgId);
  if (!membership) {
    throw new MockHttpError(403, "No membership for organization");
  }
  record.orgId = membership.organizationId;
  return loginEnvelope(user, membership.organizationId);
};

export const joinOrganization = (
  payload: { joinCode: string; role: OrganizationRole },
  sessionToken?: string,
): AuthEnvelope => {
  const { user } = ensureSession(sessionToken);
  const org = organizations[payload.joinCode];
  if (!org) {
    throw new MockHttpError(404, "Organization not found");
  }
  if (org.type === "PRIVATE") {
    throw new MockHttpError(400, "Private organizations cannot be joined");
  }
  const existing = user.memberships?.find((member) => member.organizationId === org.id);
  if (existing) {
    return loginEnvelope(user, org.id);
  }
  const membership = {
    id: `mem-${createId()}`,
    organizationId: org.id,
    role: payload.role,
    organization: { name: org.name, type: org.type },
  };
  user.memberships = [...(user.memberships ?? []), membership];
  user.organizationId = org.id;
  user.organizationRole = payload.role;
  const record = getSessionRecord(sessionToken);
  record.orgId = org.id;
  return loginEnvelope(user, org.id);
};

export const listTests = (requestOrgId: string | null, sessionToken?: string): { items: PolicyTest[] } => {
  const { orgId } = ensureSession(sessionToken);
  const allowedOrg = ensureOrgAccess(requestOrgId, orgId);
  return { items: policyTests.filter((test) => test.orgId === allowedOrg) };
};

export const getTest = (testId: string, requestOrgId: string | null, sessionToken?: string): { test: PolicyTest } => {
  const { orgId } = ensureSession(sessionToken);
  const allowedOrg = ensureOrgAccess(requestOrgId, orgId);
  const test = policyTests.find((item) => item.id === testId);
  if (!test) {
    throw new MockHttpError(404, "Not found");
  }
  if (test.orgId !== allowedOrg) {
    throw new MockHttpError(403, "Forbidden", {
      permissionKey: PermissionKey.VIEW_RESULTS,
    });
  }
  return { test };
};

export const listMaterials = (requestOrgId: string | null, sessionToken?: string): { items: Array<{ id: string; title: string; scope: "GLOBAL" | "ORGANIZATION"; orgId: string | null }> } => {
  ensureSession(sessionToken);
  const items = learningMaterials.filter((material) => {
    if (material.scope === "GLOBAL") return true;
    return requestOrgId !== null && material.orgId === requestOrgId;
  });
  return { items };
};

export const listClassrooms = (requestOrgId: string | null, sessionToken?: string): Array<{ id: string; label: string; grade: string; gradeLabel: string; section: string; teacherName: string; studentsCount: number }> => {
  const { orgId } = ensureSession(sessionToken);
  ensureOrgAccess(requestOrgId, orgId);
  return classrooms;
};

export const logAnalytics = (): { ok: boolean } => ({ ok: true });

export const getGamificationSummary = (sessionToken?: string): typeof gamificationSummary => {
  ensureSession(sessionToken);
  return gamificationSummary;
};

export const getAnalyticsSummary = (): typeof analyticsSummary => analyticsSummary;

export const createSubmission = (
  testId: string,
  requestOrgId: string | null,
  sessionToken?: string,
): { submission: SubmissionRecord } => {
  const { user, orgId } = ensureSession(sessionToken);
  const allowedOrg = ensureOrgAccess(requestOrgId, orgId);
  const test = policyTests.find((item) => item.id === testId);
  if (!test || test.orgId !== allowedOrg) {
    throw new MockHttpError(404, "Test not available");
  }
  const attemptKey = `${user.id}:${test.id}`;
  const attempts = submissionAttempts.get(attemptKey) ?? 0;
  if (attempts >= test.maxAttempts) {
    throw new MockHttpError(403, "Max attempts reached");
  }
  const submission: SubmissionRecord = {
    id: `sub-${createId()}`,
    userId: user.id,
    testId: test.id,
    status: "draft",
    answers: {},
  };
  submissions.set(submission.id, submission);
  return { submission };
};

export const updateSubmission = (
  submissionId: string,
  _requestOrgId: string | null,
  answers: Record<string, string>,
  sessionToken?: string,
): { submission: SubmissionRecord } => {
  const { user } = ensureSession(sessionToken);
  const submission = submissions.get(submissionId);
  if (!submission || submission.userId !== user.id) {
    throw new MockHttpError(404, "Submission not found");
  }
  if (submission.status === "finished") {
    throw new MockHttpError(400, "Submission already finished");
  }
  submission.answers = { ...submission.answers, ...answers };
  submissions.set(submissionId, submission);
  return { submission };
};

const evaluateSubmission = (submission: SubmissionRecord) => {
  const test = policyTests.find((item) => item.id === submission.testId);
  if (!test) return { score: 0, correct: 0, total: 0 };
  let correct = 0;
  test.questions.forEach((question) => {
    const answer = submission.answers[question.id];
    if (!answer) return;
    if (question.type === "numeric") {
      if (Number(answer) === question.correct) correct += 1;
    } else if (question.type === "text") {
      if (answer.trim().toLowerCase() === question.correct.toLowerCase()) correct += 1;
    } else if (question.type === "single") {
      if (answer === question.correct) correct += 1;
    }
  });
  const total = test.questions.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { score, correct, total };
};

export const finishSubmission = (
  submissionId: string,
  _requestOrgId: string | null,
  sessionToken?: string,
): { submission: SubmissionRecord; summary?: { score: number; correct: number; total: number } } => {
  const { user } = ensureSession(sessionToken);
  const submission = submissions.get(submissionId);
  if (!submission || submission.userId !== user.id) {
    throw new MockHttpError(404, "Submission not found");
  }
  if (submission.status === "finished") {
    return { submission };
  }
  const evaluation = evaluateSubmission(submission);
  submission.status = "finished";
  submission.score = evaluation.score;
  submissions.set(submissionId, submission);
  const attemptKey = `${user.id}:${submission.testId}`;
  submissionAttempts.set(attemptKey, (submissionAttempts.get(attemptKey) ?? 0) + 1);
  return {
    submission,
    summary: evaluation,
  };
};

export const registerUser = (
  payload: { email?: string; name?: string },
  sessionToken?: string,
): { user: User; sessionToken: string } => {
  const email = payload.email ?? `new-${createId()}@skillstorm.test`;
  const user: User & { password: string } = {
    id: `pending-${createId()}`,
    email,
    name: payload.name ?? "Nový uživatel",
    organizationRole: null,
    organizationId: null,
    memberships: [],
    permissions: [],
    password: "password",
  };
  seedUsers[email] = user;
  const token = sessionToken ?? createSessionToken();
  const record = getSessionRecord(token);
  record.userId = user.id;
  record.orgId = null;
  record.force401Once = false;
  return { user, sessionToken: token };
};

export const recordAuditEvents = (events: AuditEventPayload[]): { stored: number } => {
  auditEvents.push(...events);
  return { stored: events.length };
};
