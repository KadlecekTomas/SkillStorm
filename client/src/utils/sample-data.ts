import type { Classroom, ContentItem, ResultInsight, Subject, TestSummary } from "@/types";

export function createMockSubject(overrides?: Partial<Subject>): Subject {
  return {
    id: "mock-subject",
    name: "Mock Subject",
    organizationId: "mock-org",
    catalogSubjectId: null,
    catalogSubject: null,
    deletedAt: null,
    isActive: true,
    ...overrides,
  };
}

export const classroomSamples: Classroom[] = [
  {
    id: "cl-1",
    label: "Mathematics 2A",
    grade: "GRADE_9",
    gradeLabel: "9. ročník",
    section: "A",
    teacherName: "Eva Nováková",
    teacherEmail: "eva.novakova@skillstorm.test",
    studentsCount: 24,
    updatedAt: "Před 2 h",
  },
  {
    id: "cl-2",
    label: "English Skills Lab",
    grade: "GRADE_7",
    gradeLabel: "7. ročník",
    section: "B",
    teacherName: "Matikář",
    teacherEmail: "teacher@example.com",
    studentsCount: 18,
    updatedAt: "Dnes",
  },
];

const sampleOrgId = "org-sample";

export const testSamples: TestSummary[] = [
  {
    id: "ts-1",
    title: "Fractions Mastery",
    description: "Rychlý kvíz zaměřený na sčítání a porovnávání zlomků.",
    completionRate: 86,
    submissions: 42,
    avgScore: 78,
    subject: createMockSubject({ id: "subj-math", name: "Matematika", organizationId: sampleOrgId }),
    status: "PUBLISHED",
    version: 3,
  },
  {
    id: "ts-2",
    title: "Reading Comprehension",
    description: "Verbal reasoning a práce s textem.",
    completionRate: 92,
    submissions: 37,
    avgScore: 83,
    subject: createMockSubject({ id: "subj-lang", name: "Jazyky", organizationId: sampleOrgId }),
    status: "PUBLISHED",
    version: 2,
  },
];

export const contentSamples: ContentItem[] = [
  {
    id: "ct-1",
    title: "Eco-systems interactive deck",
    description: "Slides + mini úkoly k ekosystémům.",
    subject: "Science",
    contentType: "MATERIAL",
    scope: "ORGANIZATION",
    educationLevel: "PRIMARY_2",
    schoolGrade: "GRADE_9",
    updatedAt: "před 3 dny",
  },
  {
    id: "ct-2",
    title: "Geometry sprint cards",
    description: "Kartičky pro rychlé procvičování obvodů.",
    subject: "Matematika",
    contentType: "PRACTICE",
    scope: "ORGANIZATION",
    educationLevel: "PRIMARY_2",
    schoolGrade: "GRADE_7",
    updatedAt: "včera",
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
