'use client';

import type { CSSProperties, JSX } from 'react';
import {
  directionGlyph,
  type AlgorithmState,
  type AlgorithmWorld,
  type GridPosition,
} from '@/lib/it-lab/algorithm-engine';

type Accent = 'violet' | 'rose';

type Props = {
  accent: Accent;
  impact?: boolean;
  state: AlgorithmState;
  testIdPrefix: string;
  world: AlgorithmWorld;
};

const robotClass: Record<Accent, string> = {
  violet: 'border-violet-300/35 bg-violet-400/10 shadow-violet-500/10',
  rose: 'border-rose-300/35 bg-rose-400/10 shadow-rose-500/10',
};

const directionClass: Record<Accent, string> = {
  violet: 'bg-violet-300',
  rose: 'bg-rose-300',
};

function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function AnimatedRobotArena({ accent, impact = false, state, testIdPrefix, world }: Props): JSX.Element {
  const robotStyle: CSSProperties = {
    width: `${100 / world.width}%`,
    height: `${100 / world.height}%`,
    left: `${state.position.x * (100 / world.width)}%`,
    top: `${state.position.y * (100 / world.height)}%`,
  };

  return (
    <div className="relative aspect-[5/3] overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${world.width}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${world.height}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: world.width * world.height }, (_, index) => {
          const position = { x: index % world.width, y: Math.floor(index / world.width) };
          const isTarget = samePosition(world.target, position);
          const isObstacle = world.obstacles?.some((candidate) => samePosition(candidate, position));

          return (
            <div
              key={index}
              className="relative grid place-items-center border border-slate-800"
              data-testid={`${testIdPrefix}-cell-${position.x}-${position.y}`}
            >
              <span className="absolute left-2 top-1 text-[10px] text-slate-700">{position.x},{position.y}</span>
              {isObstacle && <span className="text-3xl" aria-label="překážka">🧱</span>}
              {isTarget && <span className="text-3xl" aria-label="cíl">⚡</span>}
            </div>
          );
        })}
      </div>

      <div
        className="pointer-events-none absolute z-20 grid place-items-center transition-[left,top] duration-500 ease-in-out"
        style={robotStyle}
      >
        <div
          data-testid={`${testIdPrefix}-robot`}
          data-x={state.position.x}
          data-y={state.position.y}
          className={`relative grid h-16 w-16 place-items-center rounded-2xl border text-3xl shadow-xl transition-transform duration-300 ${robotClass[accent]} ${impact ? 'scale-110 ring-4 ring-rose-300/30' : ''}`}
        >
          🤖
          <span className={`absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full text-sm font-black text-slate-950 ${directionClass[accent]}`}>
            {directionGlyph[state.direction]}
          </span>
        </div>
      </div>
    </div>
  );
}
