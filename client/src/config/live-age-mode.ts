import { parseGradeNumber } from "./answering-mode";

/**
 * Věkové režimy projekce Bleskovky (živá cvičení na tabuli).
 *
 * Tři úrovně (na rozdíl od binárního `resolveAnsweringMode` pro testy):
 * - "young"  (1.–3. ZŠ): velké dlaždice, ikony, Parťák-blob, bez odpočtu
 * - "middle" (4.–9. ZŠ): kompaktnější, odpočet, střízlivější parťák
 * - "senior" (SŠ): quiz-night vzhled, jen emblém, tempo + streak
 *
 * Fallback při neznámém ročníku je "middle" — projekce je nízkorizikový
 * prezentační kontext (na rozdíl od testu, kde se selhává do "old", tedy do
 * plného režimu s časovačem a kontrolou). Viz docs/live-sessions.md.
 *
 * Režim je ČISTĚ prezentační — neovlivňuje data odesílaná na backend
 * (server ukládá zvolený `ageMode` jen kvůli obnovení projekce).
 */
export type LiveAgeMode = "young" | "middle" | "senior";

export const LIVE_YOUNG_MAX_GRADE = 3;

/** Mapování na serverový enum LiveAgeMode (YOUNG/MIDDLE/SENIOR). */
export const toServerLiveAgeMode = (
  mode: LiveAgeMode,
): "YOUNG" | "MIDDLE" | "SENIOR" =>
  mode.toUpperCase() as "YOUNG" | "MIDDLE" | "SENIOR";

export const fromServerLiveAgeMode = (mode: string): LiveAgeMode => {
  const lower = mode.toLowerCase();
  return lower === "young" || lower === "senior" ? lower : "middle";
};

/**
 * Odvodí režim z ročníku (SchoolGrade enum nebo lidský zápis), s volitelným
 * override — učitel může úroveň ručně přepnout před spuštěním.
 */
export function resolveLiveAgeMode(
  grade: string | null | undefined,
  override?: string | null,
): LiveAgeMode {
  if (override === "young" || override === "middle" || override === "senior") {
    return override;
  }
  const value = grade?.trim().toUpperCase() ?? "";
  if (value.startsWith("HIGH_SCHOOL_YEAR_")) return "senior";
  const gradeNumber = parseGradeNumber(grade);
  if (gradeNumber == null) return "middle";
  return gradeNumber <= LIVE_YOUNG_MAX_GRADE ? "young" : "middle";
}
