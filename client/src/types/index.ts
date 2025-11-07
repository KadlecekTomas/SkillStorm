export type Classroom = {
  id: string;
  name: string;
  grade: string;
  subject: string;
  students: number;
  updatedAt?: string;
};

export type TestSummary = {
  id: string;
  title: string;
  subject: string;
  avgScore: number;
  completionRate: number;
  submissions: number;
};

export type ContentItem = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  updatedAt?: string;
};

export type ResultInsight = {
  id: string;
  label: string;
  value: string | number;
  trend: "up" | "down";
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: "teacher" | "student" | "admin";
  avatarUrl?: string;
  organization?: string;
};
