export type TrendLabel = "BETTER" | "SAME" | "WORSE";

export type StudentErrorAnalyticsItem = {
  errorCategoryId: string;
  errorCategoryLabel: string;
  count: number;
  share: number;
  trend: TrendLabel;
};

export type StudentTopicAnalyticsItem = {
  topicId: string;
  topicName: string;
  successRate: number;
  trend: TrendLabel;
};

export type TeacherErrorAnalyticsItem = {
  errorCategoryId: string;
  errorCategoryLabel: string;
  count: number;
  distributionLabel: string;
  trend: TrendLabel;
};

export type TeacherTopicAnalyticsItem = {
  topicId: string;
  topicName: string;
  avgSuccess: number;
  dispersionLabel: string;
  trend: TrendLabel;
};

