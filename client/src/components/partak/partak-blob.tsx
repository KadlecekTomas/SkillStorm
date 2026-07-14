import type { JSX } from "react";

export type PartakMood = "idle" | "happy";

export interface PartakBlobProps {
  size?: number;
  mood?: PartakMood;
}

/*
 * Parťák — motivační společník SkillStormu (mladší podoba, 1.–3. třída).
 * SVG převzato 1:1 z docs/design-reference.jsx; barvy vedou přes tokeny
 * (fill-accent apod.), detaily obličeje jsou vlastní konstanty maskota.
 */
const FACE = "#25341a";
const INNER_GLOW = "#6fdb1a";

export const PartakBlob = ({ size = 120, mood = "idle" }: PartakBlobProps): JSX.Element => {
  const eyeY = mood === "happy" ? 46 : 50;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={mood === "happy" ? "animate-wiggle" : "animate-bob"}
      aria-label="Parťák"
      role="img"
    >
      <path
        d="M60 12 C92 12 106 40 104 66 C102 94 84 108 60 108 C36 108 18 94 16 66 C14 40 28 12 60 12 Z"
        className="fill-accent"
      />
      <path
        d="M60 18 C86 18 98 42 96 64 C94 88 80 100 60 100 C40 100 26 88 24 64 C22 42 34 18 60 18 Z"
        fill={INNER_GLOW}
        opacity=".55"
      />
      <ellipse cx="44" cy={eyeY} rx="7" ry={mood === "happy" ? 4 : 9} fill={FACE} />
      <ellipse cx="76" cy={eyeY} rx="7" ry={mood === "happy" ? 4 : 9} fill={FACE} />
      {mood === "happy" ? (
        <path d="M46 70 Q60 84 74 70" stroke={FACE} strokeWidth="5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M50 72 Q60 78 70 72" stroke={FACE} strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
      <circle cx="34" cy="64" r="6" fill="#ffffff" opacity=".35" />
      <circle cx="86" cy="64" r="6" fill="#ffffff" opacity=".35" />
      <path
        d="M52 10 Q60 0 68 10"
        className="stroke-accent-deep"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};
