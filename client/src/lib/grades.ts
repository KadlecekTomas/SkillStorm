export const ALL_SCHOOL_GRADES = [
  "GRADE_1",
  "GRADE_2",
  "GRADE_3",
  "GRADE_4",
  "GRADE_5",
  "GRADE_6",
  "GRADE_7",
  "GRADE_8",
  "GRADE_9",
  "HIGH_SCHOOL_YEAR_1",
  "HIGH_SCHOOL_YEAR_2",
  "HIGH_SCHOOL_YEAR_3",
  "HIGH_SCHOOL_YEAR_4",
] as const;

export type SchoolGradeValue = (typeof ALL_SCHOOL_GRADES)[number];

const GRADE_LABELS: Record<SchoolGradeValue, string> = {
  GRADE_1: "1. ročník",
  GRADE_2: "2. ročník",
  GRADE_3: "3. ročník",
  GRADE_4: "4. ročník",
  GRADE_5: "5. ročník",
  GRADE_6: "6. ročník",
  GRADE_7: "7. ročník",
  GRADE_8: "8. ročník",
  GRADE_9: "9. ročník",
  HIGH_SCHOOL_YEAR_1: "SŠ 1. ročník",
  HIGH_SCHOOL_YEAR_2: "SŠ 2. ročník",
  HIGH_SCHOOL_YEAR_3: "SŠ 3. ročník",
  HIGH_SCHOOL_YEAR_4: "SŠ 4. ročník",
};

export function gradeLabel(grade: string): string {
  return GRADE_LABELS[grade as SchoolGradeValue] ?? grade;
}

export function formatAllowedGrades(grades: string[]): string {
  if (!grades.length) return "Bez ročníků";
  return grades.map(gradeLabel).join(", ");
}

export function normalizeAllowedGrades(grades: unknown): string[] {
  return Array.isArray(grades) ? grades.filter((grade): grade is string => typeof grade === "string") : [];
}
