import {
  AUDIT_METADATA_ALLOWLIST,
  AUDIT_METADATA_DENYLIST,
} from './audit-metadata.policy';

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 50;
const MAX_CHANGED_FIELDS = 50;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDenylisted(key: string): boolean {
  return AUDIT_METADATA_DENYLIST.has(normalizeKey(key));
}

/**
 * Recursively sanitize a nested value (object / array / primitive).
 *
 * At this level the ALLOWLIST is NOT applied — only the credential denylist.
 * This keeps intentionally structured forensic context while stripping secrets
 * at any depth, including objects nested inside arrays.
 */
function sanitizeValue(input: unknown): unknown {
  if (typeof input === 'string') {
    return input.length > MAX_STRING_LENGTH
      ? `${input.slice(0, MAX_STRING_LENGTH)}…`
      : input;
  }

  if (Array.isArray(input)) {
    return input.slice(0, MAX_ARRAY_LENGTH).map(sanitizeValue);
  }

  if (input !== null && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (isDenylisted(k)) continue;
      result[k] = sanitizeValue(v);
    }
    return result;
  }

  return input;
}

type BodySummary = {
  bodyKeys: string[];
  bodySize: number;
  bodyHasNested: boolean;
};

function summarizeBody(body: unknown): BodySummary | null {
  if (
    body === null ||
    body === undefined ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return null;
  }
  const obj = body as Record<string, unknown>;
  const keys = Object.keys(obj);
  return {
    bodyKeys: keys.slice(0, 30),
    bodySize: keys.length,
    bodyHasNested: Object.values(obj).some(
      (v) => typeof v === 'object' && v !== null,
    ),
  };
}

/**
 * `changedFields` is forensic structure, not a before/after data snapshot.
 * Persist field NAMES only. This prevents callers that pass an update DTO from
 * copying names, e-mails, student numbers or credentials into AuditLog while
 * still answering "what changed?".
 */
export function sanitizeAuditChangedFields(input: unknown): string[] | null {
  if (input === null || input === undefined) return null;

  const candidates = Array.isArray(input)
    ? input.filter((value): value is string => typeof value === 'string')
    : typeof input === 'object'
      ? Object.keys(input as Record<string, unknown>)
      : [];

  const fields = Array.from(
    new Set(
      candidates
        .map((field) => field.trim())
        .filter((field) => field.length > 0 && !isDenylisted(field)),
    ),
  )
    .sort()
    .slice(0, MAX_CHANGED_FIELDS);

  return fields.length > 0 ? fields : null;
}

/**
 * Sanitize the top-level audit log metadata object.
 *
 * Processing order:
 *   1. BODY TRANSFORM — if `body` key exists and is an object, replace it with
 *      `{ bodyKeys, bodySize, bodyHasNested }`. No actual values are propagated.
 *   2. DENYLIST — strip credential-shaped keys (case/punctuation insensitive).
 *   3. ALLOWLIST — keep only explicitly approved top-level forensic keys.
 *   4. Recurse into surviving values via `sanitizeValue` (denylist-only at depth).
 *
 * Returns `null` when the result is empty so callers can skip writing metadata.
 */
export function sanitizeAuditMetadata(input: unknown): unknown | null {
  if (input === null || input === undefined) return null;

  // Non-object scalars or arrays at the root: just value-sanitize and return.
  if (typeof input !== 'object' || Array.isArray(input)) {
    return sanitizeValue(input);
  }

  const obj = { ...(input as Record<string, unknown>) };

  // Step 1: transform body before any other filtering.
  let bodyTransformed = false;
  if ('body' in obj) {
    const summary = summarizeBody(obj['body']);
    delete obj['body'];
    if (summary !== null) {
      obj['bodyKeys'] = summary.bodyKeys;
      obj['bodySize'] = summary.bodySize;
      obj['bodyHasNested'] = summary.bodyHasNested;
      bodyTransformed = true;
    }
  }

  const result: Record<string, unknown> = {};
  const strippedKeys: string[] = [];

  // Steps 2 + 3: denylist then allowlist.
  for (const [k, v] of Object.entries(obj)) {
    if (isDenylisted(k)) {
      strippedKeys.push(k);
      continue;
    }
    if (!AUDIT_METADATA_ALLOWLIST.has(k)) {
      strippedKeys.push(k);
      continue;
    }
    // Step 4: deep-sanitize the surviving value.
    result[k] = sanitizeValue(v);
  }

  if (process.env.NODE_ENV !== 'production') {
    if (bodyTransformed) {
      console.warn('[AUDIT] body transformed to safe summary');
    }
    if (strippedKeys.length > 0) {
      console.warn('[AUDIT] metadata stripped keys:', strippedKeys);
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
