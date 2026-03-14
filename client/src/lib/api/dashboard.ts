"use client";

import { httpClient } from "@/lib/http/client";

/**
 * Stats Overview Response from backend
 */
export interface StatsOverviewResponse {
  scope: "evaluated" | "all";
  totalTests: number;
  counts: {
    approved: number;
    rejected: number;
    pending: number;
    all: number;
  };
  totalSubmissions: number;
  pendingSubmissions: number;
  passRate: number;
  passRateEvaluated: number;
  passRateAll: number;
  avgScore: number | null;
  lastSubmittedAt: string | null;
}

/**
 * Teacher Dashboard Response from backend
 */
export interface TeacherDashboardResponse {
  classroomsCount: number;
  studentsCount: number;
  testsCreated: number;
  avgScoreOnMyTests: number | null;
  pendingSubmissions: number;
  recentActivity: Array<{
    id: string;
    testId: string;
    testTitle: string;
    studentName: string | null;
    score: number | null;
    status: string;
    submittedAt: string;
  }>;
}

/**
 * Student Dashboard Response from backend
 */
export interface StudentDashboardResponse {
  member: {
    id: string;
    name: string | null;
    organization: string | null;
    xp: number | null;
    level: number | null;
  };
  testsTaken: number;
  avgScore: number | null;
  lastSubmissions: Array<{
    id: string;
    testId: string;
    testTitle: string;
    score: number | null;
    submittedAt: string;
    status: string;
  }>;
  byTest: Array<{
    testId: string;
    latest: {
      id: string;
      testId: string;
      score: number | null;
      submittedAt: string;
    } | null;
    best: {
      id: string;
      testId: string;
      score: number | null;
      submittedAt: string;
    } | null;
  }>;
}

/**
 * Fetch organization overview stats
 * @param scope - 'evaluated' or 'all' (default: 'evaluated')
 */
export async function getDashboardOverview(
  scope: "evaluated" | "all" = "evaluated"
): Promise<StatsOverviewResponse> {
  return httpClient.get<StatsOverviewResponse>("/stats/overview", {
    query: { scope },
  });
}

/**
 * Fetch teacher dashboard data
 */
export async function getDashboardTeacher(): Promise<TeacherDashboardResponse> {
  return httpClient.get<TeacherDashboardResponse>("/dashboards/teacher");
}

/**
 * Fetch student dashboard data
 */
export async function getDashboardStudent(): Promise<StudentDashboardResponse> {
  return httpClient.get<StudentDashboardResponse>("/dashboards/student");
}

/**
 * Director Dashboard Response from backend
 */
export interface DirectorDashboardResponse {
  testsThisMonth: number;
  submissionsThisWeek: number;
  activeTeachersThisWeek: number;
  activeClassesThisWeek: number;
  classes: Array<{
    id: string;
    label: string;
    teacherName: string | null;
    studentCount: number;
    avgScore: number | null;
    submissionsThisWeek: number;
    lastActivityAt: string | null;
    riskLevel: "NONE" | "MEDIUM" | "HIGH";
  }>;
  teachers: Array<{
    membershipId: string;
    name: string;
    testsCreated: number;
    submissionsThisWeek: number;
    lastActivityAt: string | null;
    activeThisWeek: boolean;
  }>;
  atRiskStudents: Array<{
    studentId: string;
    displayName: string;
    classLabel: string;
    averageScorePercent: number;
    lastActivityAt: string | null;
  }>;
}

/**
 * Fetch director dashboard data
 */
export async function getDashboardDirector(): Promise<DirectorDashboardResponse> {
  return httpClient.get<DirectorDashboardResponse>("/dashboards/director");
}

// ---------------------------------------------------------------------------
// Student assignment overview
// ---------------------------------------------------------------------------

export type AssignmentOverviewItem = {
  assignmentId: string;
  testId: string;
  title: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
  remainingAttempts: number;
  attemptsUsed: number;
};

export type AssignmentsOverviewResponse = {
  now: string;
  active: AssignmentOverviewItem[];
  upcoming: AssignmentOverviewItem[];
  closedUnsubmitted: AssignmentOverviewItem[];
  completed: AssignmentOverviewItem[];
};

/**
 * Fetch bucketed assignment overview for the current student.
 */
export async function getAssignmentsOverview(): Promise<AssignmentsOverviewResponse> {
  return httpClient.get<AssignmentsOverviewResponse>("/assignments/overview");
}
