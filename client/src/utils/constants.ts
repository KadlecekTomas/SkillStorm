export const roleBadges: Record<string, { label: string; tone: string }> = {
  teacher: { label: "Teacher", tone: "success" },
  student: { label: "Student", tone: "info" },
  admin: { label: "Admin", tone: "warning" },
};

export const gradeFilters = [
  { label: "All grades", value: "All" },
  { label: "7th Grade", value: "GRADE_7" },
  { label: "8th Grade", value: "GRADE_8" },
  { label: "9th Grade", value: "GRADE_9" },
];
export const subjectFilters = ["Mathematics", "Science", "Languages"];
