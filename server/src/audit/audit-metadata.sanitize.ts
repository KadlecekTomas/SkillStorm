import {
  AUDIT_METADATA_ALLOWLIST,
  AUDIT_METADATA_DENYLIST,
} from './audit-metadata.policy';

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 50;

function isDenylisted(key: string): boolean {
  return AUDIT_METADATA_DENYLIST.has(key.toLowerCase());
}

/**
 * Recursively sanitize a nested value (object / array / primitive).
 *
 * At this level the ALLOWLIST is NOT applied — only the DENYLIST.
 * This allows `before`/`after` objects to preserve their actual field names
 * (e.g. `name`, `status`) while still stripping secrets at any depth.
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
 * Sanitize the top-level audit log metadata object.
 *
 * Processing order:
 *   1. BODY TRANSFORM — if `body` key exists and is an object, replace it with
 *      `{ bodyKeys, bodySize, bodyHasNested }`. No actual values are propagated.
 *   2. DENYLIST — strip keys matching a sensitive name (case-insensitive).
 *   3. ALLOWLIST — keep only keys present in AUDIT_METADATA_ALLOWLIST.
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
