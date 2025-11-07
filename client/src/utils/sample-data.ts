import type { Classroom, ContentItem, ResultInsight, TestSummary } from "@/types";

export const classroomSamples: Classroom[] = [
  {
    id: "cl-1",
    name: "Mathematics 2A",
    grade: "2nd Grade",
    students: 24,
    subject: "Mathematics",
    updatedAt: "2h ago",
  },
  {
    id: "cl-2",
    name: "English Skills Lab",
    grade: "1st Grade",
    students: 18,
    subject: "Languages",
    updatedAt: "Today",
  },
];

export const testSamples: TestSummary[] = [
  {
    id: "ts-1",
    title: "Fractions Mastery",
    completionRate: 86,
    submissions: 42,
    avgScore: 78,
    subject: "Mathematics",
  },
  {
    id: "ts-2",
    title: "Reading Comprehension",
    completionRate: 92,
    submissions: 37,
    avgScore: 83,
    subject: "Languages",
  },
];

export const contentSamples: ContentItem[] = [
  {
    id: "ct-1",
    title: "Eco-systems interactive deck",
    subject: "Science",
    grade: "3rd Grade",
    updatedAt: "3 days ago",
  },
  {
    id: "ct-2",
    title: "Geometry sprint cards",
    subject: "Mathematics",
    grade: "2nd Grade",
    updatedAt: "1 day ago",
  },
];

export const resultInsights: ResultInsight[] = [
  { id: "ri-1", label: "Mastered Units", value: 18, trend: "up" },
  { id: "ri-2", label: "Pending Reviews", value: 6, trend: "down" },
];

export const chartSamples = [
  { label: "Jan", teacher: 72, student: 64 },
  { label: "Feb", teacher: 78, student: 69 },
  { label: "Mar", teacher: 81, student: 72 },
  { label: "Apr", teacher: 84, student: 74 },
  { label: "May", teacher: 87, student: 77 },
  { label: "Jun", teacher: 90, student: 80 },
];
