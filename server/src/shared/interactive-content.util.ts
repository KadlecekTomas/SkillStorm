/**
 * Autorská data interaktivních typů otázek (MATCH_PAIRS / ORDER / SORT_BINS).
 * Single source of truth pro tvary `Question.content` a jejich validaci —
 * používá tests.service (add/updateQuestion), test-assignability.util
 * (publish gate) a live-sessions.service (snapshot kol při startu).
 *
 * Interaktivní otázky jsou POUZE pro bleskovky: validní obsah pouští publish
 * sady, ale blokuje assignTest (viz INTERACTIVE_ONLY_QUESTION v assignability).
 */
import { QuestionType } from '@prisma/client';

export const INTERACTIVE_QUESTION_TYPES = [
  QuestionType.MATCH_PAIRS,
  QuestionType.ORDER,
  QuestionType.SORT_BINS,
] as const;

export type InteractiveQuestionType =
  (typeof INTERACTIVE_QUESTION_TYPES)[number];

export function isInteractiveQuestionType(
  type: string,
): type is InteractiveQuestionType {
  return (INTERACTIVE_QUESTION_TYPES as readonly string[]).includes(type);
}

/** Limity obsahu — drží je builder (UI), DTO validace i publish gate. */
export const INTERACTIVE_LIMITS = {
  MATCH_PAIRS: { minPairs: 4, maxPairs: 6 },
  ORDER: { minItems: 4, maxItems: 6 },
  SORT_BINS: { minBins: 2, maxBins: 3, minCards: 6, maxCards: 10 },
} as const;

export interface MatchPairsContent {
  pairs: { id: string; left: string; right: string }[];
}

export interface OrderContent {
  items: { id: string; text: string }[];
  /** Popisky konců osy, např. { start: "nejmenší", end: "největší" }. */
  labels?: { start?: string; end?: string };
}

export interface SortBinsContent {
  bins: { id: string; label: string }[];
  cards: { id: string; text: string; binId: string }[];
}

export type InteractiveContent =
  | MatchPairsContent
  | OrderContent
  | SortBinsContent;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasUniqueValues(values: string[]): boolean {
  return (
    new Set(values.map((v) => v.trim().toLowerCase())).size === values.length
  );
}

/**
 * Validace obsahu interaktivní otázky. Vrací seznam chybových kódů
 * (prázdný = validní) — kódy jsou stabilní, UI builderu na ně věší hlášky.
 */
export function validateInteractiveContent(
  type: InteractiveQuestionType,
  content: unknown,
): string[] {
  if (!isRecord(content)) return ['CONTENT_REQUIRED'];

  if (type === QuestionType.MATCH_PAIRS) {
    const { minPairs, maxPairs } = INTERACTIVE_LIMITS.MATCH_PAIRS;
    const pairs = content.pairs;
    if (!Array.isArray(pairs)) return ['PAIRS_REQUIRED'];
    const errors: string[] = [];
    if (pairs.length < minPairs || pairs.length > maxPairs) {
      errors.push('PAIRS_COUNT_OUT_OF_RANGE');
    }
    const valid = pairs.every(
      (p: unknown) =>
        isRecord(p) &&
        nonEmptyString(p.id) &&
        nonEmptyString(p.left) &&
        nonEmptyString(p.right),
    );
    if (!valid) {
      errors.push('PAIR_TEXTS_REQUIRED');
      return errors;
    }
    const typed = pairs as MatchPairsContent['pairs'];
    if (!hasUniqueValues(typed.map((p) => p.id))) errors.push('DUPLICATE_IDS');
    if (!hasUniqueValues(typed.map((p) => p.left))) {
      errors.push('DUPLICATE_LEFT_TEXTS');
    }
    if (!hasUniqueValues(typed.map((p) => p.right))) {
      errors.push('DUPLICATE_RIGHT_TEXTS');
    }
    return errors;
  }

  if (type === QuestionType.ORDER) {
    const { minItems, maxItems } = INTERACTIVE_LIMITS.ORDER;
    const items = content.items;
    if (!Array.isArray(items)) return ['ITEMS_REQUIRED'];
    const errors: string[] = [];
    if (items.length < minItems || items.length > maxItems) {
      errors.push('ITEMS_COUNT_OUT_OF_RANGE');
    }
    const valid = items.every(
      (i: unknown) =>
        isRecord(i) && nonEmptyString(i.id) && nonEmptyString(i.text),
    );
    if (!valid) {
      errors.push('ITEM_TEXTS_REQUIRED');
      return errors;
    }
    const typed = items as OrderContent['items'];
    if (!hasUniqueValues(typed.map((i) => i.id))) errors.push('DUPLICATE_IDS');
    if (!hasUniqueValues(typed.map((i) => i.text))) {
      errors.push('DUPLICATE_ITEM_TEXTS');
    }
    return errors;
  }

  // SORT_BINS
  const { minBins, maxBins, minCards, maxCards } = INTERACTIVE_LIMITS.SORT_BINS;
  const bins = content.bins;
  const cards = content.cards;
  if (!Array.isArray(bins) || !Array.isArray(cards)) {
    return ['BINS_AND_CARDS_REQUIRED'];
  }
  const errors: string[] = [];
  if (bins.length < minBins || bins.length > maxBins) {
    errors.push('BINS_COUNT_OUT_OF_RANGE');
  }
  if (cards.length < minCards || cards.length > maxCards) {
    errors.push('CARDS_COUNT_OUT_OF_RANGE');
  }
  const binsValid = bins.every(
    (b: unknown) =>
      isRecord(b) && nonEmptyString(b.id) && nonEmptyString(b.label),
  );
  const cardsValid = cards.every(
    (c: unknown) =>
      isRecord(c) &&
      nonEmptyString(c.id) &&
      nonEmptyString(c.text) &&
      nonEmptyString(c.binId),
  );
  if (!binsValid || !cardsValid) {
    errors.push('BIN_CARD_TEXTS_REQUIRED');
    return errors;
  }
  const typedBins = bins as SortBinsContent['bins'];
  const typedCards = cards as SortBinsContent['cards'];
  const binIds = new Set(typedBins.map((b) => b.id));
  if (
    !hasUniqueValues(typedBins.map((b) => b.id)) ||
    !hasUniqueValues(typedCards.map((c) => c.id))
  ) {
    errors.push('DUPLICATE_IDS');
  }
  if (!hasUniqueValues(typedBins.map((b) => b.label))) {
    errors.push('DUPLICATE_BIN_LABELS');
  }
  if (!hasUniqueValues(typedCards.map((c) => c.text))) {
    errors.push('DUPLICATE_CARD_TEXTS');
  }
  if (typedCards.some((c) => !binIds.has(c.binId))) {
    errors.push('CARD_BIN_NOT_FOUND');
  }
  for (const bin of typedBins) {
    if (!typedCards.some((c) => c.binId === bin.id)) {
      errors.push('EMPTY_BIN');
      break;
    }
  }
  return errors;
}
