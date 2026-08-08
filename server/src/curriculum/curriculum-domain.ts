import { createHash } from 'node:crypto';
import type { SchoolGrade } from '@prisma/client';

export type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike | undefined };

function normalizeJson(value: JsonLike): JsonLike {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalizeJson(child as JsonLike)]),
    );
  }
  return value;
}

export function stableJsonStringify(value: JsonLike): string {
  return JSON.stringify(normalizeJson(value));
}

export function curriculumChecksum(value: JsonLike): string {
  return createHash('sha256').update(stableJsonStringify(value)).digest('hex');
}

export type FrameworkOutcomeComparable = {
  externalCode: string;
  sourceAnchor?: string | null;
  fieldExternalCode: string;
  title: string;
  description?: string | null;
  metadata?: JsonLike;
  checksum?: string;
};

export type FrameworkDiffType =
  | 'ADDED_OUTCOME'
  | 'REMOVED_OUTCOME'
  | 'TEXT_CHANGED'
  | 'CODE_CHANGED'
  | 'FIELD_MOVED'
  | 'METADATA_CHANGED';

export type FrameworkDiffEntry = {
  type: FrameworkDiffType;
  identity: string;
  previousCode?: string;
  nextCode?: string;
};

function outcomeIdentity(outcome: FrameworkOutcomeComparable): string {
  return outcome.sourceAnchor?.trim() || outcome.externalCode;
}

function textFingerprint(outcome: FrameworkOutcomeComparable): string {
  return curriculumChecksum({
    title: outcome.title,
    description: outcome.description ?? null,
  });
}

function metadataFingerprint(outcome: FrameworkOutcomeComparable): string {
  return curriculumChecksum((outcome.metadata ?? null) as JsonLike);
}

export function diffFrameworkOutcomes(
  previous: FrameworkOutcomeComparable[],
  next: FrameworkOutcomeComparable[],
): FrameworkDiffEntry[] {
  const previousByIdentity = new Map(
    previous.map((outcome) => [outcomeIdentity(outcome), outcome]),
  );
  const nextByIdentity = new Map(
    next.map((outcome) => [outcomeIdentity(outcome), outcome]),
  );
  const identities = [...new Set([...previousByIdentity.keys(), ...nextByIdentity.keys()])].sort();
  const diff: FrameworkDiffEntry[] = [];

  for (const identity of identities) {
    const before = previousByIdentity.get(identity);
    const after = nextByIdentity.get(identity);
    if (!before && after) {
      diff.push({ type: 'ADDED_OUTCOME', identity, nextCode: after.externalCode });
      continue;
    }
    if (before && !after) {
      diff.push({ type: 'REMOVED_OUTCOME', identity, previousCode: before.externalCode });
      continue;
    }
    if (!before || !after) continue;

    if (before.externalCode !== after.externalCode) {
      diff.push({
        type: 'CODE_CHANGED',
        identity,
        previousCode: before.externalCode,
        nextCode: after.externalCode,
      });
    }
    if (before.fieldExternalCode !== after.fieldExternalCode) {
      diff.push({
        type: 'FIELD_MOVED',
        identity,
        previousCode: before.externalCode,
        nextCode: after.externalCode,
      });
    }
    if (textFingerprint(before) !== textFingerprint(after)) {
      diff.push({
        type: 'TEXT_CHANGED',
        identity,
        previousCode: before.externalCode,
        nextCode: after.externalCode,
      });
    }
    if (metadataFingerprint(before) !== metadataFingerprint(after)) {
      diff.push({
        type: 'METADATA_CHANGED',
        identity,
        previousCode: before.externalCode,
        nextCode: after.externalCode,
      });
    }
  }

  return diff;
}

export type ApplicabilityCandidate = {
  id: string;
  classSectionId: string | null;
  grade: SchoolGrade | null;
  priority: number;
};

export class AmbiguousCurriculumApplicabilityError extends Error {
  constructor(public readonly candidateIds: string[]) {
    super('CURRICULUM_APPLICABILITY_AMBIGUOUS');
    this.name = 'AmbiguousCurriculumApplicabilityError';
  }
}

function candidateSpecificity(
  candidate: ApplicabilityCandidate,
  classSectionId: string,
  grade: SchoolGrade,
): number {
  if (candidate.classSectionId === classSectionId) return 3;
  if (!candidate.classSectionId && candidate.grade === grade) return 2;
  if (!candidate.classSectionId && candidate.grade === null) return 1;
  return 0;
}

export function pickCurriculumApplicability<T extends ApplicabilityCandidate>(
  candidates: T[],
  classSectionId: string,
  grade: SchoolGrade,
): T | null {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      specificity: candidateSpecificity(candidate, classSectionId, grade),
    }))
    .filter((row) => row.specificity > 0)
    .sort(
      (a, b) =>
        b.specificity - a.specificity ||
        b.candidate.priority - a.candidate.priority ||
        a.candidate.id.localeCompare(b.candidate.id),
    );

  const first = ranked[0];
  if (!first) return null;

  const equallyRanked = ranked.filter(
    (row) =>
      row.specificity === first.specificity &&
      row.candidate.priority === first.candidate.priority,
  );

  if (equallyRanked.length > 1) {
    throw new AmbiguousCurriculumApplicabilityError(
      equallyRanked.map((row) => row.candidate.id),
    );
  }

  return first.candidate;
}
