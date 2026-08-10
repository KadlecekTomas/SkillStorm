'use client';

import { useMemo, useState, type JSX } from 'react';
import { Braces, Play, Repeat2, RotateCcw, Sparkles } from 'lucide-react';
import {
  executeBlockProgram,
  type BlockProgramNode,
} from '@/lib/it-lab/block-program-engine';
import {
  directionGlyph,
  type AlgorithmCommand,
  type AlgorithmWorld,
  type GridPosition,
} from '@/lib/it-lab/algorithm-engine';

type PaletteItem = 'FORWARD' | 'LEFT' | 'RIGHT' | 'REPEAT_3';

const world: AlgorithmWorld = {
  width: 5,
  height: 3,
  target: { x: 4, y: 2 },
  obstacles: [{ x: 4, y: 0 }],
};

const commandLabel: Record<AlgorithmCommand, string> = {
  FORWARD: 'Krok vpřed',
  LEFT: 'Otoč vlevo',
  RIGHT: 'Otoč vpravo',
};

function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export default function BlockProgrammingPage(): JSX.Element {
  const [program, setProgram] = useState<BlockProgramNode[]>([]);
  const [result, setResult] = useState<ReturnType<typeof executeBlockProgram> | null>(null);
  const [runCount, setRunCount] = useState(0);

  const expandedCount = useMemo(() => {
    const count = (nodes: BlockProgramNode[]): number =>
      nodes.reduce((total, node) => total + (node.type === 'COMMAND' ? 1 : node.count * count(node.body)), 0);
    return count(program);
  }, [program]);

  const targetReached = Boolean(result?.valid && samePosition(result.state.position, world.target));
  const usedRepeat = program.some((node) => node.type === 'REPEAT');

  function add(item: PaletteItem): void {
    setResult(null);
    if (item === 'REPEAT_3') {
      setProgram((current) => [
        ...current,
        { type: 'REPEAT', count: 3, body: [{ type: 'COMMAND', command: 'FORWARD' }] },
      ]);
      return;
    }
    setProgram((current) => [...current, { type: 'COMMAND', command: item }]);
  }

  function run(): void {
    setRunCount((current) => current + 1);
    setResult(executeBlockProgram(program, world));
  }

  function reset(): void {
    setProgram([]);
    setResult(null);
    setRunCount(0);
  }

  const finalPosition = result?.state.position ?? { x: 0, y: 0 };

  return (
    <main className="min-h-screen bg-[#07101f] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">IT-2 · Block Programming</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">Loop Mission</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Dostaň robota do cíle a použij opakování. Nejde o nejkratší čas — cílem je poznat, která část algoritmu se opakuje a zabalit ji do jednoho bloku.
            </p>
          </div>
          <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.06] px-4 py-3 text-sm text-violet-100">
            <strong>{expandedCount}</strong> vykonaných kroků · <strong>{program.length}</strong> bloků
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Simulace</p>
                <h2 className="mt-1 text-xl font-black">Robot arena</h2>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">Start [0,0] → cíl [4,2]</span>
            </div>

            <div className="grid aspect-[5/3] grid-cols-5 grid-rows-3 overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
              {Array.from({ length: 15 }, (_, index) => {
                const position = { x: index % 5, y: Math.floor(index / 5) };
                const isRobot = samePosition(finalPosition, position);
                const isTarget = samePosition(world.target, position);
                const isObstacle = world.obstacles?.some((candidate) => samePosition(candidate, position));
                return (
                  <div key={index} className="relative grid place-items-center border border-slate-800" data-testid={`block-cell-${position.x}-${position.y}`}>
                    <span className="absolute left-2 top-1 text-[10px] text-slate-700">{position.x},{position.y}</span>
                    {isObstacle && <span className="text-3xl" aria-label="překážka">🧱</span>}
                    {isTarget && <span className="text-3xl" aria-label="cíl">⚡</span>}
                    {isRobot && (
                      <div data-testid="block-robot" data-x={finalPosition.x} data-y={finalPosition.y} className="relative z-10 grid h-16 w-16 place-items-center rounded-2xl border border-violet-300/30 bg-violet-400/10 text-3xl shadow-xl">
                        🤖
                        <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-violet-300 text-sm font-black text-slate-950">
                          {directionGlyph[result?.state.direction ?? 'EAST']}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">Execution trace</p>
              <div data-testid="block-trace" className="mt-2 max-h-36 space-y-1 overflow-auto text-sm text-slate-300">
                {!result ? (
                  <p className="text-slate-600">Spusť program a uvidíš rozbalené kroky smyčky.</p>
                ) : result.steps.map((step) => (
                  <p key={`${step.stepNumber}-${step.sourcePath.join('.')}`}>
                    {step.stepNumber}. {commandLabel[step.command]} → [{step.state.position.x},{step.state.position.y}] {directionGlyph[step.state.direction]}{step.valid ? '' : ` · ${step.reason}`}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center gap-3">
                <Braces className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">1 · Paleta bloků</p>
                  <h2 className="text-lg font-black">Sestav program</h2>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button data-testid="block-add-forward" onClick={() => add('FORWARD')} className="rounded-2xl bg-cyan-300 px-4 py-3 font-black text-slate-950">↑ Krok</button>
                <button data-testid="block-add-right" onClick={() => add('RIGHT')} className="rounded-2xl bg-slate-800 px-4 py-3 font-black">↷ Vpravo</button>
                <button data-testid="block-add-left" onClick={() => add('LEFT')} className="rounded-2xl bg-slate-800 px-4 py-3 font-black">↶ Vlevo</button>
                <button data-testid="block-add-repeat" onClick={() => add('REPEAT_3')} className="flex items-center justify-center gap-2 rounded-2xl bg-violet-300 px-4 py-3 font-black text-slate-950">
                  <Repeat2 className="h-4 w-4" aria-hidden="true" /> Opakuj 3× krok
                </button>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">2 · Program</p>
                  <h2 className="text-lg font-black">Bloky v pořadí</h2>
                </div>
                <button onClick={reset} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white"><RotateCcw className="h-4 w-4" /> Reset</button>
              </div>
              <div data-testid="block-program" className="mt-4 min-h-28 space-y-2 rounded-2xl bg-slate-950/70 p-3">
                {program.length === 0 ? <p className="p-3 text-sm text-slate-500">Začni blokem. Zkus najít opakující se část trasy.</p> : program.map((node, index) => (
                  <div key={index} className={`rounded-xl px-3 py-3 font-bold ${node.type === 'REPEAT' ? 'border border-violet-300/20 bg-violet-300/10 text-violet-100' : 'bg-slate-900 text-slate-200'}`}>
                    {node.type === 'COMMAND' ? commandLabel[node.command] : `Opakuj ${node.count}× → ${node.body.map((item) => item.type === 'COMMAND' ? commandLabel[item.command] : 'vnořený blok').join(', ')}`}
                  </div>
                ))}
              </div>
              <button data-testid="block-run" disabled={program.length === 0} onClick={run} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">
                <Play className="h-4 w-4" /> Spustit blokový program
              </button>
            </div>

            {result && (
              <div data-testid="block-result" className={`rounded-[30px] border p-5 ${targetReached && usedRepeat ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-amber-300/30 bg-amber-300/10'}`}>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-amber-200" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">3 · Test & debug</p>
                    <h3 className="mt-1 text-xl font-black">{targetReached && usedRepeat ? 'Mise splněna se smyčkou.' : 'Ještě jedna iterace.'}</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {!result.valid
                        ? `Program selhal na vykonaném kroku ${result.failedStep}. Najdi blok, ze kterého tento krok vznikl.`
                        : !targetReached
                          ? `Robot skončil na [${result.state.position.x},${result.state.position.y}]. Cíl je [4,2].`
                          : 'Do cíle ses dostal, ale cílem této mise je nahradit opakující se příkazy blokem Opakuj.'}
                    </p>
                    <p className="mt-3 text-xs font-bold text-slate-500">Počet spuštění: {runCount} · completion ≠ mastery</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
