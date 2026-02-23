/**
 * GDPR allowlist: pick only allowed fields from API responses so we never render PII
 * even if the backend accidentally returns extra fields.
 */
import type {
  StudentDetailResponse,
  StudentDetailPerformanceSummary,
  StudentDetailProgressByTopic,
  StudentDetailRecentTest,
} from "@/lib/api/students";

function allowlistPerformanceSummary(raw: unknown): StudentDetailPerformanceSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    averageScore: typeof o.averageScore === "number" ? o.averageScore : 0,
    completedTests: typeof o.completedTests === "number" ? o.completedTests : 0,
    lastActivityAt: typeof o.lastActivityAt === "string" || o.lastActivityAt === null ? o.lastActivityAt : null,
  };
}

function allowlistProgressByTopic(raw: unknown): StudentDetailProgressByTopic | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    topicId: typeof o.topicId === "string" ? o.topicId : "",
    topicName: typeof o.topicName === "string" ? o.topicName : "",
    averageScore: typeof o.averageScore === "number" ? o.averageScore : 0,
  };
}

function allowlistRecentTest(raw: unknown): StudentDetailRecentTest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    testId: typeof o.testId === "string" ? o.testId : "",
    title: typeof o.title === "string" ? o.title : "",
    score: typeof o.score === "number" || o.score === null ? o.score : null,
    maxScore: typeof o.maxScore === "number" || o.maxScore === null ? o.maxScore : null,
    submittedAt: typeof o.submittedAt === "string" || o.submittedAt === null ? o.submittedAt : null,
  };
}

const DEFAULT_PERFORMANCE_SUMMARY: StudentDetailPerformanceSummary = {
  averageScore: 0,
  completedTests: 0,
  lastActivityAt: null,
};

/**
 * Returns a strict allowlisted copy of student detail. Ignores any extra keys (e.g. email, username).
 * Accepts either the detail object or a single-nested { data: detail } for resilience.
 */
export function studentDetailAllowlist(raw: unknown): StudentDetailResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const inner = typeof o.data === "object" && o.data !== null ? (o.data as Record<string, unknown>) : o;

  const perf =
    inner.performanceSummary != null
      ? allowlistPerformanceSummary(inner.performanceSummary)
      : null;
  const performanceSummary = perf ?? DEFAULT_PERFORMANCE_SUMMARY;

  const progressByTopic = Array.isArray(inner.progressByTopic)
    ? (inner.progressByTopic as unknown[])
        .map(allowlistProgressByTopic)
        .filter((t): t is StudentDetailProgressByTopic => t != null)
    : [];

  const recentTests = Array.isArray(inner.recentTests)
    ? (inner.recentTests as unknown[])
        .map(allowlistRecentTest)
        .filter((t): t is StudentDetailRecentTest => t != null)
    : [];

  const id = typeof inner.id === "string" ? inner.id : "";
  const displayName = typeof inner.displayName === "string" ? inner.displayName : "";
  if (!id && !displayName) return null;

  return {
    id,
    displayName,
    classroomLabel: typeof inner.classroomLabel === "string" ? inner.classroomLabel : "",
    performanceSummary,
    progressByTopic,
    recentTests,
  };
}
