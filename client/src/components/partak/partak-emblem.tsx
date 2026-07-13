import type { JSX } from "react";

/*
 * Parťák — heraldický emblém (starší podoba, 7.–9. třída; také logo v hlavičce).
 * SVG převzato 1:1 z docs/design-reference.jsx.
 */
const FACE = "#25341a";

export const PartakEmblem = ({ size = 40 }: { size?: number }): JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    aria-label="Parťák — emblém"
    role="img"
  >
    <path
      d="M24 3 L42 10 V25 C42 36 33 43 24 45 C15 43 6 36 6 25 V10 Z"
      className="fill-accent-soft stroke-accent-deep"
      strokeWidth="2.5"
    />
    <path
      d="M24 10 L35 14.5 V25 C35 32 29.5 36.5 24 38 C18.5 36.5 13 32 13 25 V14.5 Z"
      className="fill-accent"
    />
    <circle cx="20" cy="23" r="2.4" fill={FACE} />
    <circle cx="28" cy="23" r="2.4" fill={FACE} />
    <path d="M20 29 Q24 32 28 29" stroke={FACE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
  </svg>
);
