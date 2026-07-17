/**
 * Barvy grafů z design tokenů (globals.css). Recharts zapisuje barvy jako
 * SVG atributy, kde `var(--…)` nefunguje — proto se token přečte za běhu
 * z computed style. Fallbacky odpovídají výchozím hodnotám tokenů, takže
 * SSR/first paint nikdy nerozbije barevnost.
 */

const FALLBACKS = {
  accent: "88 204 2",
  "accent-deep": "61 138 0",
  xp: "28 176 246",
  streak: "255 150 0",
  danger: "255 75 75",
  line: "233 231 226",
  "ink-dim": "160 156 146",
  "ink-muted": "111 107 98",
} as const;

export type ChartToken = keyof typeof FALLBACKS;

export function chartColor(token: ChartToken, alpha = 1): string {
  let triplet: string = FALLBACKS[token];
  if (typeof window !== "undefined") {
    const fromCss = getComputedStyle(document.documentElement)
      .getPropertyValue(`--${token}`)
      .trim();
    if (fromCss) triplet = fromCss;
  }
  return alpha >= 1 ? `rgb(${triplet})` : `rgb(${triplet} / ${alpha})`;
}
