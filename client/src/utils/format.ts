/**
 * Safe display formatters.
 * All functions return "—" when the value is null, undefined, or non-finite (NaN / ±Infinity).
 * This prevents "NaN%" and "undefined%" from ever reaching the UI.
 */

/**
 * Format a percentage value (0–100 scale) as "X%" with 1 decimal place.
 * Returns "—" when value is null, undefined, or non-finite.
 *
 * @example formatPercent(83.3) → "83.3%"
 * @example formatPercent(null)  → "—"
 * @example formatPercent(NaN)   → "—"
 */
export function formatPercent(v: number | null | undefined): string {
  if (v == null) return "—";
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v * 10) / 10}%`;
}

/**
 * Format an integer count.
 * Returns "—" when value is null, undefined, or non-finite.
 *
 * @example formatInt(42)   → "42"
 * @example formatInt(null) → "—"
 */
export function formatInt(v: number | null | undefined): string {
  if (v == null) return "—";
  if (!Number.isFinite(v)) return "—";
  return String(Math.round(v));
}
