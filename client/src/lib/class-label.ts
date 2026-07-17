/**
 * Sdílené formátování ročníků a názvů tříd. Jediné místo, kde se smí
 * interpretovat syrový enum SchoolGrade ("GRADE_2", "HIGH_SCHOOL_YEAR_1") —
 * UI nikdy nezobrazuje enum hodnotu přímo.
 */

type ClassLike = {
  grade: string;
  section: string;
  label?: string | null;
};

/** "GRADE_3" → 3, "HIGH_SCHOOL_YEAR_2" → 2, jinak null. */
export function gradeNumber(grade: string): number | null {
  const basic = grade.match(/^GRADE_(\d{1,2})$/);
  if (basic) return Number(basic[1]);
  const high = grade.match(/^HIGH_SCHOOL_YEAR_(\d)$/);
  if (high) return Number(high[1]);
  return null;
}

export function isHighSchoolGrade(grade: string): boolean {
  return grade.startsWith("HIGH_SCHOOL_YEAR_");
}

/** Krátká podoba ročníku: "2." (ZŠ) / "G2" (gymnázium). Fallback: vstup beze změny. */
export function formatGradeShort(grade: string): string {
  const n = gradeNumber(grade);
  if (n == null) return grade;
  return isHighSchoolGrade(grade) ? `G${n}` : `${n}.`;
}

/** Dlouhá podoba ročníku: "2. třída" / "2. ročník gymnázia". */
export function formatGradeLong(grade: string): string {
  const n = gradeNumber(grade);
  if (n == null) return grade;
  return isHighSchoolGrade(grade) ? `${n}. ročník gymnázia` : `${n}. třída`;
}

/**
 * Zobrazovaný název třídy: explicitní label vyhrává ("2.B", "G2"),
 * jinak se skládá z ročníku a oddělení ("2.B", "G2.A").
 */
export function formatClassName(cls: ClassLike): string {
  const label = cls.label?.trim();
  if (label) return label;
  const n = gradeNumber(cls.grade);
  if (n == null) return `${cls.grade} ${cls.section}`.trim();
  if (isHighSchoolGrade(cls.grade)) {
    // Gymnázium: oddělení bývá shodné s ročníkem ("G2") — neduplikovat.
    return cls.section && cls.section !== String(n)
      ? `G${n}.${cls.section}`
      : `G${n}`;
  }
  return `${n}.${cls.section}`;
}
