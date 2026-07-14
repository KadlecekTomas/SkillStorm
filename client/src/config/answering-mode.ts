/**
 * Věkové režimy odpovídací obrazovky (design reference: TestRun age modes).
 *
 * "young" (1.–{YOUNG_MODE_MAX_GRADE}. třída): velké dlaždice 2×2, Parťák,
 * zjednodušený status bar. "old": kompaktní seznam, klávesy 1–4, plný časovač.
 *
 * Režim je ČISTĚ prezentační — nikdy neovlivňuje data odesílaná na backend.
 */
export type AnsweringMode = "young" | "old";

/** Hranice mladšího režimu (ročník <= této hodnotě → "young"). */
export const YOUNG_MODE_MAX_GRADE = 3;

/** Query param pro ruční přepnutí režimu na demu (?mode=young|old). */
export const ANSWERING_MODE_QUERY_PARAM = "mode";

/**
 * Vytáhne číslo ročníku z různých formátů: "GRADE_3" (SchoolGrade enum),
 * "3", "3.B", "3B". Střední škola ("HIGH_SCHOOL_YEAR_x") a neparsovatelné
 * hodnoty vrací null.
 */
export function parseGradeNumber(grade: string | null | undefined): number | null {
  if (!grade) return null;
  const value = grade.trim().toUpperCase();
  if (value.startsWith("HIGH_SCHOOL_YEAR_")) return null;
  const enumMatch = value.match(/^GRADE_(\d{1,2})$/);
  if (enumMatch?.[1]) return Number(enumMatch[1]);
  const leadingMatch = value.match(/^(\d{1,2})(?:\s*[.\s]?\s*[A-ZÁ-Ž])?$/);
  if (leadingMatch?.[1]) return Number(leadingMatch[1]);
  return null;
}

/**
 * Odvodí režim z ročníku, s volitelným override (např. z query paramu).
 * Neparsovatelný/chybějící ročník → "old" (bezpečnější směr selhání:
 * plný testový režim s časovačem a kontrolou).
 */
export function resolveAnsweringMode(
  grade: string | null | undefined,
  override?: string | null,
): AnsweringMode {
  if (override === "young" || override === "old") return override;
  const gradeNumber = parseGradeNumber(grade);
  if (gradeNumber == null) return "old";
  return gradeNumber <= YOUNG_MODE_MAX_GRADE ? "young" : "old";
}
