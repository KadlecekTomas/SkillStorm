import { LiveAgeMode, LiveRoundOutcome, SchoolGrade } from '@prisma/client';

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

/** Anonymní agregáty hlasů z tabule — {"A": 14, "B": 6}, žádná vazba na osoby. */
export type RoundVoteCounts = Partial<Record<OptionKey, number>>;

/**
 * Prahy auto-outcome z hlasování (podíl hlasů pro správnou odpověď).
 * Zlomky (čitatel/jmenovatel) místo floatů — přesně 2/3 a 1/3 hlasů musí
 * padnout deterministicky. Outcome je jen odvozená hodnota pro učitelův
 * přehled; do XP ani kampaní nevstupuje (stejně jako ruční soud).
 */
export const VOTE_CORRECT_MIN_SHARE = { num: 2, den: 3 } as const; // ≥ 2/3 → MOSTLY_CORRECT
export const VOTE_WRONG_MAX_SHARE = { num: 1, den: 3 } as const; // ≤ 1/3 → MOSTLY_WRONG

/** Auto-outcome z hlasů; null když se nehlasovalo nebo nepřišel žádný hlas. */
export function computeVoteOutcome(
  counts: RoundVoteCounts | null | undefined,
  correctKey: string,
): LiveRoundOutcome | null {
  if (!counts) return null;
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  if (total <= 0) return null;
  const correct = counts[correctKey as OptionKey] ?? 0;
  if (correct * VOTE_CORRECT_MIN_SHARE.den >= total * VOTE_CORRECT_MIN_SHARE.num) {
    return LiveRoundOutcome.MOSTLY_CORRECT;
  }
  if (correct * VOTE_WRONG_MAX_SHARE.den <= total * VOTE_WRONG_MAX_SHARE.num) {
    return LiveRoundOutcome.MOSTLY_WRONG;
  }
  return LiveRoundOutcome.SPLIT;
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
