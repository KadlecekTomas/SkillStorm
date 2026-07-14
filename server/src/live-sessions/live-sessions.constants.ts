import { LiveAgeMode, SchoolGrade } from '@prisma/client';

/**
 * XP třídního parťáka — POUZE za odehraná kola a dokončené bleskovky.
 * Správnost odpovědí (LiveRoundOutcome) do výpočtu nikdy nevstupuje;
 * viz docs/live-sessions.md a e2e test live-sessions.e2e-spec.ts.
 */
export const XP_PER_PLAYED_ROUND = 10;
export const XP_PER_FINISHED_SESSION = 50;

/** Lineární prahy stage; stage = 1 + floor(xp / STAGE_XP_STEP). */
export const STAGE_XP_STEP = 300;

export function computeStage(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / STAGE_XP_STEP);
}

/** Klíče možností v kole — max 4 (A–D). */
export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export interface RoundOptionSnapshot {
  key: OptionKey;
  text: string;
}

const YOUNG_MAX_GRADE = 3;

/**
 * Default věkového režimu projekce podle ročníku třídy. Fallback bez třídy /
 * neznámý ročník je MIDDLE — jde o nízkorizikový prezentační kontext (jiná
 * volba než u testového resolveAnsweringMode, viz docs/live-sessions.md).
 */
export function resolveDefaultLiveAgeMode(
  grade: SchoolGrade | null | undefined,
): LiveAgeMode {
  if (!grade) return LiveAgeMode.MIDDLE;
  if (grade.startsWith('HIGH_SCHOOL_YEAR_')) return LiveAgeMode.SENIOR;
  const match = /^GRADE_(\d{1,2})$/.exec(grade);
  if (!match) return LiveAgeMode.MIDDLE;
  return Number(match[1]) <= YOUNG_MAX_GRADE
    ? LiveAgeMode.YOUNG
    : LiveAgeMode.MIDDLE;
}
