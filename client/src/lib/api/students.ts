/**
 * GDPR-minimal student detail (no PII).
 */
export type StudentDetailPerformanceSummary = {
  averageScore: number;
  completedTests: number;
  lastActivityAt: string | null;
};

export type StudentDetailProgressByTopic = {
  topicId: string;
  topicName: string;
  averageScore: number;
};

export type StudentDetailRecentTest = {
  testId: string;
  title: string;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
};

export type StudentDetailResponse = {
  id: string;
  displayName: string;
  classroomLabel: string;
  performanceSummary: StudentDetailPerformanceSummary;
  progressByTopic: StudentDetailProgressByTopic[];
  recentTests: StudentDetailRecentTest[];
};
