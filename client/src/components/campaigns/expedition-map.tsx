"use client";

import type { JSX } from "react";
import { PartakBlob } from "@/components/partak";
import type { CampaignUnlockedStep } from "@/lib/api/campaigns";
import { cn } from "@/utils/cn";

/*
 * Mapa Výpravy — vlastní ilustrační scéna (kopečky, les, hrad) v design
 * tokenech. Hravá, ne infantilní: měkké tvary, žádné kreslené obličeje
 * kromě parťáka. Zastávky leží na S-křivce; pozice se počítají parametricky,
 * takže mapa funguje pro libovolný počet zastávek z obsahu.
 *
 * Co mapa ukazuje:
 *  - projeté zastávky: plný kroužek + samolepka (emoji) + název,
 *  - další zastávka: čárkovaná silueta + název (kam dnes jdeme),
 *  - budoucí zastávky: jen matné tečky — žádné spoilery,
 *  - parťák: stojí na dosažené zastávce; během bleskovky poposkakuje
 *    po úseku podle odehraných kol (segmentFraction, čistě prezentační).
 */

const VIEW_W = 1000;
const VIEW_H = 540;

export interface ExpeditionMapProps {
  totalSteps: number;
  /** Počet dokončených zastávek (position z progressu). */
  position: number;
  /** 0..1 v rámci aktuálního úseku — pohyb parťáka během bleskovky. */
  segmentFraction?: number;
  unlockedSteps: CampaignUnlockedStep[];
  nextStep: { stepIndex: number; title: string } | null;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

/** Zastávky na S-křivce zleva doprava, mírně stoupá k hradu vpravo nahoře. */
function stopPositions(n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = n <= 1 ? 0 : i / (n - 1);
    pts.push({
      x: 80 + t * (VIEW_W - 180),
      y: 380 - 190 * t + 62 * Math.sin(t * Math.PI * 2.2 + 0.4),
    });
  }
  return pts;
}

/** Hladká cesta přes zastávky (kvadratické úseky přes středy). */
function pathThrough(pts: Point[], from: number, to: number): string {
  if (to <= from) return "";
  const seg = pts.slice(Math.max(0, from), to + 1);
  const first = seg[0];
  if (!first || seg.length < 2) return "";
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < seg.length; i += 1) {
    const prev = seg[i - 1];
    const cur = seg[i];
    if (!prev || !cur) break;
    const mx = (prev.x + cur.x) / 2;
    const my = (prev.y + cur.y) / 2 - 24;
    d += ` Q ${mx} ${my} ${cur.x} ${cur.y}`;
  }
  return d;
}

function pointBetween(a: Point, b: Point, f: number): Point {
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * 26,
  };
}

/** Jehličnan — dva trojúhelníky + kmínek, vede přes tokeny. */
function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }): JSX.Element {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden>
      <rect x="-4" y="26" width="8" height="14" rx="2" className="fill-streak" opacity=".55" />
      <path d="M0 -26 L22 12 L-22 12 Z" className="fill-accent" opacity=".8" />
      <path d="M0 -6 L26 30 L-26 30 Z" className="fill-accent-deep" opacity=".75" />
    </g>
  );
}

/** Hrad u poslední zastávky — cíl výpravy. */
function Castle({ x, y }: { x: number; y: number }): JSX.Element {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <rect x="-34" y="-30" width="68" height="52" rx="6" className="fill-surface" />
      <rect x="-46" y="-52" width="24" height="74" rx="5" className="fill-canvas" />
      <rect x="22" y="-52" width="24" height="74" rx="5" className="fill-canvas" />
      <path d="M-46 -52 L-34 -68 L-22 -52 Z" className="fill-streak" />
      <path d="M22 -52 L34 -68 L46 -52 Z" className="fill-streak" />
      <rect x="-8" y="-2" width="16" height="24" rx="8" className="fill-ink" opacity=".35" />
      <path d="M-34 -30 h68 v-8 h-10 v6 h-10 v-6 h-8 v6 h-10 v-6 h-8 v6 h-10 v-6 h-12 Z" className="fill-line-strong" opacity=".6" />
    </g>
  );
}

export function ExpeditionMap({
  totalSteps,
  position,
  segmentFraction = 0,
  unlockedSteps,
  nextStep,
  className,
}: ExpeditionMapProps): JSX.Element {
  const pts = stopPositions(totalSteps);
  const unlockedByIndex = new Map(
    unlockedSteps.map((u) => [u.stepIndex, u] as const),
  );

  // Parťák: na dosažené zastávce (index position), během session posunutý
  // o segmentFraction směrem k další. position=0 → před první zastávkou.
  const trailhead: Point = { x: 36, y: 420 };
  const fromIdx = Math.max(0, position - 1);
  const standing =
    position === 0 ? trailhead : (pts[fromIdx] ?? trailhead);
  const target = pts[Math.min(position, totalSteps - 1)] ?? standing;
  const inSegment = segmentFraction > 0 && position < totalSteps;
  const partakAt = inSegment
    ? pointBetween(standing, target, Math.min(1, segmentFraction))
    : standing;

  // Projetá cesta končí na poslední dosažené zastávce (index position-1).
  const completedPath = pathThrough(pts, 0, Math.min(position, totalSteps) - 1);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Mapa výpravy"
      data-testid="expedition-map"
      data-position={position}
    >
      {/* Slunce + kopečky v pozadí */}
      <circle cx="90" cy="70" r="34" className="fill-streak" opacity=".5" />
      <circle cx="90" cy="70" r="22" className="fill-streak" opacity=".65" />
      <ellipse cx="180" cy="560" rx="420" ry="180" className="fill-accent-soft" />
      <ellipse cx="640" cy="600" rx="520" ry="210" className="fill-accent" opacity=".14" />
      <ellipse cx="960" cy="580" rx="380" ry="190" className="fill-accent-soft" opacity=".8" />

      {/* Les kolem prostředních zastávek */}
      <Tree x={330} y={210} s={0.8} />
      <Tree x={392} y={188} s={1} />
      <Tree x={452} y={214} s={0.7} />
      <Tree x={210} y={330} s={0.9} />
      <Tree x={700} y={300} s={0.85} />
      <Tree x={760} y={330} s={0.65} />

      {/* Hrad u cíle */}
      {(() => {
        const goal = pts[pts.length - 1] ?? trailhead;
        return <Castle x={goal.x + 8} y={goal.y - 64} />;
      })()}

      {/* Cesta: projetá plná, zbytek tečkovaný */}
      <path
        d={pathThrough(pts, 0, totalSteps - 1)}
        fill="none"
        strokeLinecap="round"
        strokeDasharray="2 16"
        strokeWidth="7"
        className="stroke-line-strong"
        opacity=".7"
      />
      {position > 0 ? (
        <path
          d={completedPath}
          fill="none"
          strokeLinecap="round"
          strokeWidth="8"
          className="stroke-accent"
          opacity=".85"
        />
      ) : null}

      {/* Zastávky */}
      {pts.map((p, i) => {
        const stepIndex = i + 1;
        const unlocked = unlockedByIndex.get(stepIndex);
        const isNext = nextStep?.stepIndex === stepIndex;
        if (unlocked) {
          return (
            <g key={stepIndex} data-testid={`map-stop-${stepIndex}`} data-state="unlocked">
              <circle cx={p.x} cy={p.y} r="26" className="fill-accent" />
              <circle cx={p.x} cy={p.y} r="21" className="fill-canvas" />
              <text
                x={p.x}
                y={p.y + 8}
                textAnchor="middle"
                fontSize="24"
                aria-hidden
              >
                {unlocked.content?.sticker?.emoji ?? "⭐"}
              </text>
              <text
                x={p.x}
                y={p.y + 52}
                textAnchor="middle"
                fontSize="17"
                fontWeight="700"
                className="fill-ink"
              >
                {unlocked.content?.title ?? `Zastávka ${stepIndex}`}
              </text>
            </g>
          );
        }
        if (isNext) {
          return (
            <g key={stepIndex} data-testid={`map-stop-${stepIndex}`} data-state="next">
              <circle
                cx={p.x}
                cy={p.y}
                r="26"
                fill="none"
                strokeWidth="4"
                strokeDasharray="7 7"
                className="animate-pulse stroke-accent-deep"
              />
              <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize="26" className="fill-accent-deep" fontWeight="800">
                ?
              </text>
              <text
                x={p.x}
                y={p.y + 52}
                textAnchor="middle"
                fontSize="17"
                fontWeight="700"
                className="fill-ink-muted"
              >
                {nextStep?.title}
              </text>
            </g>
          );
        }
        return (
          <circle
            key={stepIndex}
            data-testid={`map-stop-${stepIndex}`}
            data-state="future"
            cx={p.x}
            cy={p.y}
            r="10"
            className="fill-line-strong"
            opacity=".5"
          />
        );
      })}

      {/* Parťák na cestě */}
      <g
        data-testid="map-partak"
        style={{
          transform: `translate(${partakAt.x - 30}px, ${partakAt.y - 78}px)`,
          transition: "transform .9s cubic-bezier(.34,1.4,.5,1)",
        }}
      >
        <PartakBlob size={60} mood={inSegment ? "happy" : "idle"} />
      </g>
    </svg>
  );
}
