import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// =======================================================
// Policy Score Harness – compatible with Vitest + NestJS
// =======================================================

// Lokální definice místo importu z vitest
export type Awaitable<T = void> = T | Promise<T>;

// Kategorie politik, které se měří
export const POLICY_CATEGORIES = [
  'Auth',
  'RBAC',
  'Multitenancy',
  'Content',
  'Tests',
  'Submissions',
  'Audit',
  'Plans',
] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

// Datové struktury pro výsledky
export interface PolicyFailure {
  category: PolicyCategory;
  description: string;
  details?: string;
}

export interface PolicyBucket {
  passed: number;
  total: number;
  failures: PolicyFailure[];
}

export interface PolicyScorecard {
  passed: number;
  total: number;
  failures: PolicyFailure[];
  byCategory: Record<PolicyCategory, PolicyBucket>;
}

const SCORE_SNAPSHOT_FILE = resolve(
  process.cwd(),
  'tests/policy/.policy-score.json',
);
let snapshotReset = false;

function persistScorecard(score: PolicyScorecard) {
  try {
    writeFileSync(SCORE_SNAPSHOT_FILE, JSON.stringify(score, null, 2), 'utf8');
  } catch {
    // snapshot persistence is best-effort only
  }
}

function resetSnapshotIfNeeded() {
  if (snapshotReset) return;
  snapshotReset = true;
  try {
    unlinkSync(SCORE_SNAPSHOT_FILE);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn(
        '⚠️ Unable to reset policy score snapshot:',
        error.message ?? error,
      );
    }
  }
}

// Globální úložiště skóre
declare global {
  // eslint-disable-next-line no-var
  var POLICY_SCORE: PolicyScorecard | undefined;
}

// Inicializace globálního scorecardu
export function ensurePolicyScorecard(): PolicyScorecard {
  resetSnapshotIfNeeded();
  if (!globalThis.POLICY_SCORE) {
    const buckets = POLICY_CATEGORIES.reduce<
      Record<PolicyCategory, PolicyBucket>
    >(
      (acc, category) => {
        acc[category] = { passed: 0, total: 0, failures: [] };
        return acc;
      },
      {} as Record<PolicyCategory, PolicyBucket>,
    );
    globalThis.POLICY_SCORE = {
      passed: 0,
      total: 0,
      failures: [],
      byCategory: buckets,
    };
    persistScorecard(globalThis.POLICY_SCORE);
  }
  return globalThis.POLICY_SCORE;
}

export function loadPolicyScoreSnapshot(): PolicyScorecard | null {
  try {
    const raw = readFileSync(SCORE_SNAPSHOT_FILE, 'utf8');
    return JSON.parse(raw) as PolicyScorecard;
  } catch {
    return null;
  }
}

// Hlavní funkce pro měření jednotlivých politik
export async function policyCheck(
  category: PolicyCategory,
  description: string,
  assertion: () => Awaitable<void>,
): Promise<boolean> {
  const score = ensurePolicyScorecard();
  const bucket = score.byCategory[category];
  score.total += 1;
  bucket.total += 1;

  try {
    await assertion();
    score.passed += 1;
    bucket.passed += 1;
    console.log(`✅ [${category}] ${description}`);
    persistScorecard(score);
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown failure';
    const failure: PolicyFailure = { category, description, details: message };
    score.failures.push(failure);
    bucket.failures.push(failure);
    console.warn(`❌ [${category}] ${description}: ${message}`);
    persistScorecard(score);
    return false;
  }
}

// Pomocná funkce pro explicitní zaznamenání selhání (např. mimo try/catch)
export function recordPolicyFailure(
  category: PolicyCategory,
  description: string,
  details?: string,
) {
  const score = ensurePolicyScorecard();
  const bucket = score.byCategory[category];
  const failure: PolicyFailure = { category, description, details };
  score.total += 1;
  bucket.total += 1;
  score.failures.push(failure);
  bucket.failures.push(failure);
  console.warn(`❌ [${category}] ${description}: ${details ?? 'No details'}`);
  persistScorecard(score);
}
