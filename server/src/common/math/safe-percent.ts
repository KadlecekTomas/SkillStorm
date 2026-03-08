/**
 * Safe math helpers for computing percentages without NaN or division by zero.
 * All functions return `null` when the result is undefined (e.g. denominator = 0).
 */

/**
 * Compute `(numerator / denominator) * 100`, rounded to 1 decimal place.
 * Returns `null` when:
 *  - denominator ≤ 0
 *  - either argument is not finite
 */
export function safePercent(
  numerator: number,
  denominator: number,
): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Convert a 0..1 ratio to a 0..100 percentage, rounded to 1 decimal place.
 * Returns `null` when ratio is null, undefined, or non-finite.
 */
export function ratioToPercent(ratio: number | null | undefined): number | null {
  if (ratio == null) return null;
  if (!Number.isFinite(ratio)) return null;
  return Math.round(ratio * 1000) / 10;
}

/**
 * Coerce an unknown value to `number | null`.
 * Returns `null` for null, undefined, or non-finite results.
 */
export function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
