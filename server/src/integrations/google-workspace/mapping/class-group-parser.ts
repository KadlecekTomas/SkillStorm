import { SchoolGrade } from '@prisma/client';
import {
  CLASS_CONFIDENCE_THRESHOLD,
  DEFAULT_CLASS_GROUP_PATTERNS,
} from '@/integrations/google-workspace/google-workspace.constants';
import { emailLocalPart, normalizeText } from './normalize';

export interface ClassGroupParseResult {
  /** True when grade + section were extracted (regardless of confidence). */
  matched: boolean;
  grade?: SchoolGrade;
  /** Section letter, upper-cased (e.g. "A"). */
  section?: string;
  /** Human label, e.g. "7.A". */
  label?: string;
  /** 0..1; >= CLASS_CONFIDENCE_THRESHOLD is treated as resolved. */
  confidence: number;
}

const GRADE_BY_DIGIT: Record<string, SchoolGrade> = {
  '1': SchoolGrade.GRADE_1,
  '2': SchoolGrade.GRADE_2,
  '3': SchoolGrade.GRADE_3,
  '4': SchoolGrade.GRADE_4,
  '5': SchoolGrade.GRADE_5,
  '6': SchoolGrade.GRADE_6,
  '7': SchoolGrade.GRADE_7,
  '8': SchoolGrade.GRADE_8,
  '9': SchoolGrade.GRADE_9,
};

/** Patterns whose presence implies an explicit class prefix → full confidence. */
const PREFIXED_PATTERN_INDEXES = new Set([0, 3]);

function buildResult(
  digit: string,
  letter: string,
  confidence: number,
): ClassGroupParseResult {
  const grade = GRADE_BY_DIGIT[digit]!;
  const section = letter.toUpperCase();
  return {
    matched: true,
    grade,
    section,
    label: `${digit}.${section}`,
    confidence,
  };
}

/**
 * Detect a SkillStorm class (grade + section) from a Google group's e-mail and
 * display name. Tries the configured patterns against the normalized e-mail
 * local-part and name, plus separator-stripped variants, then a loose
 * fallback. Never throws — an unrecognised group simply returns
 * `{ matched: false, confidence: 0 }`.
 *
 * Confidence model:
 *  - explicit class prefix (`trida`/`zaci`) match → 1.0
 *  - bare numeric pattern (`7a`, `7.a`, `7-a`)    → 0.9
 *  - loose digit+letter fallback                  → 0.5 (below threshold)
 */
export function parseClassGroup(
  input: { email?: string | null; name?: string | null },
  patterns: readonly string[] = DEFAULT_CLASS_GROUP_PATTERNS,
): ClassGroupParseResult {
  const compiled = patterns.map((p, index) => ({
    regex: new RegExp(p, 'i'),
    prefixed: PREFIXED_PATTERN_INDEXES.has(index),
  }));

  const sources = [emailLocalPart(input.email), normalizeText(input.name ?? '')]
    .filter(Boolean)
    // For each source add a "compact" variant with separators removed so that
    // names like "trida 7.a" collapse to "trida7a" and match the anchored
    // patterns.
    .flatMap((s) => [s, s.replace(/[\s._-]+/g, '')]);

  let best: ClassGroupParseResult = { matched: false, confidence: 0 };

  for (const source of sources) {
    for (const { regex, prefixed } of compiled) {
      const m = source.match(regex);
      if (m && m[1] && m[2] && GRADE_BY_DIGIT[m[1]]) {
        const confidence = prefixed ? 1.0 : 0.9;
        if (confidence > best.confidence) {
          best = buildResult(m[1], m[2], confidence);
        }
      }
    }
  }

  if (best.matched) return best;

  // Loose fallback: a single grade digit adjacent to a section letter anywhere.
  for (const source of sources) {
    const loose = source.match(
      /(?:^|[^0-9a-z])([1-9])[\s._-]?([a-z])(?![a-z])/i,
    );
    if (loose && loose[1] && loose[2] && GRADE_BY_DIGIT[loose[1]]) {
      return buildResult(loose[1], loose[2], 0.5);
    }
  }

  return { matched: false, confidence: 0 };
}

export { CLASS_CONFIDENCE_THRESHOLD };
