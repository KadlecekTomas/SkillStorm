'use client';

import { useMemo, useState, type JSX } from 'react';
import {
  Braces,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Sparkles,
  StepForward,
  Trash2,
} from 'lucide-react';
import { AnimatedRobotArena } from '@/components/it-lab/animated-robot-arena';
import {
  MAX_EXPANDED_STEPS,
  MAX_REPEAT_COUNT,
  expandBlockProgram,
  type BlockProgramNode,
} from '@/lib/it-lab/block-program-engine';
import { useBlockProgramRunner } from '@/lib/it-lab/use-block-program-runner';
import {
  directionGlyph,
  type AlgorithmCommand,
  type AlgorithmWorld,
  type GridPosition,
} from '@/lib/it-lab/algorithm-engine';

type PaletteItem = AlgorithmCommand | 'REPEAT';

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

function containsRepeat(nodes: BlockProgramNode[]): boolean {
  return nodes.some((node) => node.type === 'REPEAT');
}

function formatSourcePath(nodePath: number[], iterationPath: number[]): string {
  if (nodePath.length === 0) return 'program';
  const labels = [`blok ${nodePath[0]! + 1}`];
  for (let depth = 1; depth < nodePath.length; depth += 1) {
    const iteration = iterationPath[depth - 1];
    if (iteration !== undefined) labels.push(`opakování ${iteration + 1}`);
    labels.push(depth === nodePath.length - 1 ? `příkaz ${nodePath[depth]! + 1}` : `blok smyčky ${nodePath[depth]! + 1}`);
  }
  return labels.join(' · ');
}

function validationMessage(reason: ReturnType<typeof expandBlockProgram>['failureReason']): string | null {
  if (reason === 'EMPTY_REPEAT_BODY') return 'Každá smyčka musí obsahovat alespoň jeden příkaz.';
  if (reason === 'INVALID_REPEAT_COUNT') return `Počet opakování musí být 1–${MAX_REPEAT_COUNT}.`;
  if (reason === 'MAX_NESTING_DEPTH_EXCEEDED') return 'Program má příliš hluboko vnořené smyčky.';
  if (reason === 'STEP_LIMIT_EXCEEDED') return `Program by vykonal více než ${MAX_EXPANDED_STEPS} kroků. Zkrať ho před spuštěním.`;
  return null;
}

export default function BlockProgrammingPage(): JSX.Element {
  const [program, setProgram] = useState<BlockProgramNode[]>([]);
  const runner = useBlockProgramRunner(program, world);

  const expansion = useMemo(() => expandBlockProgram(program), [program]);
  const expandedCount = expansion.steps.length;
  const result = runner.result;
  const targetReached = Boolean(result?.valid && samePosition(result.state.position, world.target));
  const usedRepeat = containsRepeat(program);
  const programReady = program.length > 0 && expansion.valid;
  const validationHint = validationMessage(expansion.failureReason);
  const activeTopLevelIndex = runner.activeStep?.nodePath[0] ?? null;
  const activeNestedIndex = runner.activeStep?.nodePath[1] ?? null;
  const activeIteration = runner.activeStep?.iterationPath[0] ?? null;

  function mutateProgram(mutator: (current: BlockProgramNode[]) => BlockProgramNode[]): void {
    runner.resetPlayback();
    setProgram((current) => mutator(current));
  }

  function add(item: PaletteItem): void {
    mutateProgram((current) => [
      ...current,
      item === 'REPEAT'
        ? { type: 'REPEAT', count: 3, body: [] }
        : { type: 'COMMAND', command: item },
    ]);
  }

  function removeTopLevel(index: number): void {
    mutateProgram((current) => current.filter((_, candidate) => candidate !== index));
  }

  function changeRepeatCount(index: number, delta: number): void {
    mutateProgram((current) => current.map((node, candidate) => {
      if (candidate !== index || node.type !== 'REPEAT') return node;
      const count = Math.max(1, Math.min(MAX_REPEAT_COUNT, node.count + delta));
      return { ...node, count };
    }));
  }

  function addRepeatCommand(index: number, command: AlgorithmCommand): void {
    mutateProgram((current) => current.map((node, candidate) => {
      if (candidate !== index || node.type !== 'REPEAT') return node;
      return {
        ...node,
        body: [...node.body, { type: 'COMMAND', command }],
      };
    }));
  }

  function removeRepeatCommand(index: number, bodyIndex: number): void {
    mutateProgram((current) => current.map((node, candidate) => {
      if (candidate !== index || node.type !== 'REPEAT') return node;
      return {
        ...node,
        body: node.body.filter((_, nestedIndex) => nestedIndex !== bodyIndex),
      };
    }));
  }

  function reset(): void {
    setProgram([]);
    runner.resetAll();
  }

  const runnerStatus = runner.status === 'RUNNING'
    ? `Běží · krok ${runner.visibleCount}/${runner.totalSteps}`
    : runner.status === 'PAUSED'
      ? `Pozastaveno · krok ${runner.visibleCount}/${runner.totalSteps}`
      : runner.status === 'COMPLETE'
        ? `Dokončeno · ${runner.visibleCount} kroků`
        : 'Připraveno ke spuštění';

  return (
    <main className="min-h-screen bg-[#07101f] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">IT-2 · Block Programming</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">Loop Mission</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Sestav algoritmus a potom ho opravdu sleduj při vykonávání. Aktivní blok se zvýrazní, smyčka ukáže aktuální iteraci a trace roste krok za krokem spolu s pohybem robota.
            </p>
          </div>
          <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.06] px-4 py-3 text-sm text-violet-100">
            <strong>{expandedCount}{expansion.failureReason === 'STEP_LIMIT_EXCEEDED' ? '+' : ''}</strong> kroků po rozbalení · <strong>{program.length}</strong> bloků
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Simulace</p>
                <h2 className="mt-1 text-xl font-black">Robot arena</h2>
              </div>
              <span data-testid="block-runner-status" className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">{runnerStatus}</span>
            </div>

            <AnimatedRobotArena
              accent="violet"
              impact={Boolean(runner.activeStep && !runner.activeStep.valid)}
              state={runner.state}
              testIdPrefix="block"
              world={world}
            />

            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <button data-testid="block-run" disabled={!programReady || runner.isRunning} onClick={runner.run} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                <Play className="h-4 w-4" aria-hidden="true" /> {runner.status === 'COMPLETE' ? 'Spustit znovu' : 'Spustit algoritmus'}
              </button>
              <button data-testid="block-pause" disabled={runner.status === 'IDLE' || runner.status === 'COMPLETE'} onClick={runner.togglePause} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black disabled:opacity-35">
                {runner.isRunning ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                {runner.isRunning ? 'Pauza' : 'Pokračovat'}
              </button>
              <button data-testid="block-step" disabled={!programReady || runner.isRunning} onClick={runner.step} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black disabled:opacity-35">
                <StepForward className="h-4 w-4" aria-hidden="true" /> Krok
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950/55 px-4 py-3 text-xs text-slate-400">
              <span>Rychlost simulace</span>
              <div className="flex gap-2">
                {([
                  ['SLOW', '0.5×', 'block-speed-slow'],
                  ['NORMAL', '1×', 'block-speed-normal'],
                  ['FAST', '2×', 'block-speed-fast'],
                ] as const).map(([value, label, testId]) => (
                  <button key={value} data-testid={testId} onClick={() => runner.setSpeed(value)} className={`rounded-lg px-3 py-1.5 font-black ${runner.speed === value ? 'bg-violet-300 text-slate-950' : 'bg-white/5 text-slate-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">Živý průběh vykonání</p>
                {runner.activeStep && (
                  <span data-testid="block-active-source" className="text-xs font-bold text-cyan-200">
                    {formatSourcePath(runner.activeStep.nodePath, runner.activeStep.iterationPath)}
                  </span>
                )}
              </div>
              <div data-testid="block-trace" className="mt-2 max-h-56 space-y-1 overflow-auto text-sm text-slate-300">
                {runner.visibleSteps.length === 0 ? (
                  <p className="text-slate-600">Spusť program nebo použij Krok. Trace se nebude zobrazovat dopředu.</p>
                ) : runner.visibleSteps.map((step) => (
                  <p key={`${step.stepNumber}-${step.sourcePath.join('.')}`} data-testid={`block-trace-step-${step.stepNumber}`} className={!step.valid ? 'font-bold text-rose-200' : ''}>
                    {step.stepNumber}. {commandLabel[step.command]} → [{step.state.position.x},{step.state.position.y}] {directionGlyph[step.state.direction]}
                    <span className="text-slate-600"> · {formatSourcePath(step.nodePath, step.iterationPath)}</span>
                    {step.valid ? '' : ` · ${step.reason}`}
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
                <button data-testid="block-add-forward" disabled={runner.isRunning} onClick={() => add('FORWARD')} className="rounded-2xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-35">↑ Krok</button>
                <button data-testid="block-add-right" disabled={runner.isRunning} onClick={() => add('RIGHT')} className="rounded-2xl bg-slate-800 px-4 py-3 font-black disabled:opacity-35">↷ Vpravo</button>
                <button data-testid="block-add-left" disabled={runner.isRunning} onClick={() => add('LEFT')} className="rounded-2xl bg-slate-800 px-4 py-3 font-black disabled:opacity-35">↶ Vlevo</button>
                <button data-testid="block-add-repeat" disabled={runner.isRunning} onClick={() => add('REPEAT')} className="flex items-center justify-center gap-2 rounded-2xl bg-violet-300 px-4 py-3 font-black text-slate-950 disabled:opacity-35">
                  <Repeat2 className="h-4 w-4" aria-hidden="true" /> Přidat smyčku
                </button>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">2 · Program</p>
                  <h2 className="text-lg font-black">Bloky v pořadí</h2>
                </div>
                <button onClick={reset} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset</button>
              </div>

              <div data-testid="block-program" className="mt-4 min-h-28 space-y-2 rounded-2xl bg-slate-950/70 p-3">
                {program.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">Začni blokem. Zkus najít opakující se část trasy.</p>
                ) : program.map((node, index) => {
                  const isActive = activeTopLevelIndex === index;

                  if (node.type === 'COMMAND') {
                    return (
                      <div key={index} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 font-bold transition ${isActive ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-50 ring-2 ring-cyan-300/20' : 'border-transparent bg-slate-900 text-slate-200'}`}>
                        <span>{commandLabel[node.command]}</span>
                        <button aria-label={`Odstranit blok ${index + 1}`} disabled={runner.isRunning} onClick={() => removeTopLevel(index)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white disabled:opacity-30">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={index} data-testid={`repeat-block-${index}`} className={`rounded-2xl border p-3 text-violet-100 transition ${isActive ? 'border-cyan-300/60 bg-cyan-300/15 ring-2 ring-cyan-300/20' : 'border-violet-300/20 bg-violet-300/10'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 font-black">
                          <Repeat2 className="h-4 w-4" aria-hidden="true" /> Opakuj
                          <button aria-label="Snížit počet opakování" disabled={runner.isRunning} onClick={() => changeRepeatCount(index, -1)} className="rounded-lg bg-slate-950/50 p-1 disabled:opacity-30"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                          <span data-testid={`repeat-count-${index}`} className="min-w-6 text-center">{node.count}×</span>
                          <button aria-label="Zvýšit počet opakování" disabled={runner.isRunning} onClick={() => changeRepeatCount(index, 1)} className="rounded-lg bg-slate-950/50 p-1 disabled:opacity-30"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                          {isActive && activeIteration !== null && (
                            <span data-testid={`repeat-active-iteration-${index}`} className="rounded-full bg-cyan-100/10 px-2 py-1 text-xs text-cyan-100">opakování {activeIteration + 1}/{node.count}</span>
                          )}
                        </div>
                        <button aria-label={`Odstranit smyčku ${index + 1}`} disabled={runner.isRunning} onClick={() => removeTopLevel(index)} className="rounded-lg p-1.5 text-violet-200/50 hover:bg-white/5 hover:text-white disabled:opacity-30">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="mt-3 space-y-2 rounded-xl border border-violet-200/10 bg-slate-950/40 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-200/60">Uvnitř smyčky</p>
                        {node.body.length === 0 ? (
                          <p className="text-sm text-violet-100/55">Přidej příkaz, který se má opakovat.</p>
                        ) : node.body.map((nestedNode, bodyIndex) => {
                          const nestedActive = isActive && activeNestedIndex === bodyIndex;
                          return (
                            <div key={bodyIndex} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${nestedActive ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-50' : 'border-transparent bg-slate-950/60'}`}>
                              <span>{nestedNode.type === 'COMMAND' ? commandLabel[nestedNode.command] : 'Vnořená smyčka'}</span>
                              <button aria-label={`Odstranit příkaz ze smyčky ${bodyIndex + 1}`} disabled={runner.isRunning} onClick={() => removeRepeatCommand(index, bodyIndex)} className="text-violet-200/45 hover:text-white disabled:opacity-30">
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <button data-testid={`repeat-${index}-add-forward`} disabled={runner.isRunning} onClick={() => addRepeatCommand(index, 'FORWARD')} className="rounded-lg bg-cyan-300/15 px-2 py-2 text-xs font-black text-cyan-100 disabled:opacity-30">↑ Krok</button>
                          <button data-testid={`repeat-${index}-add-left`} disabled={runner.isRunning} onClick={() => addRepeatCommand(index, 'LEFT')} className="rounded-lg bg-white/5 px-2 py-2 text-xs font-black disabled:opacity-30">↶ Vlevo</button>
                          <button data-testid={`repeat-${index}-add-right`} disabled={runner.isRunning} onClick={() => addRepeatCommand(index, 'RIGHT')} className="rounded-lg bg-white/5 px-2 py-2 text-xs font-black disabled:opacity-30">↷ Vpravo</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {validationHint && (
                <p data-testid="block-validation" className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
                  {validationHint}
                </p>
              )}
            </div>

            {result && (
              <div data-testid="block-result" className={`rounded-[30px] border p-5 ${targetReached && usedRepeat ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-amber-300/30 bg-amber-300/10'}`}>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-amber-200" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">3 · Test & debug</p>
                    <h3 className="mt-1 text-xl font-black">{targetReached && usedRepeat ? 'Mise splněna se smyčkou.' : 'Ještě jedna iterace.'}</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {!result.valid && result.failureType === 'WORLD_RULE'
                        ? `Program se zastavil přesně na vykonaném kroku ${result.failedStep}. Aktivní blok a trace ukazují, odkud chyba přišla.`
                        : !result.valid
                          ? 'Program nejde bezpečně spustit. Oprav jeho strukturu a zkus to znovu.'
                          : targetReached && usedRepeat
                            ? 'Viděl jsi smyčku rozbalit se do konkrétních kroků a robot skončil v cíli. Další mise ověří debugging a transfer.'
                            : !targetReached
                              ? `Robot skončil na [${result.state.position.x},${result.state.position.y}]. Cíl je [4,2].`
                              : 'Do cíle ses dostal, ale cílem této mise je nahradit opakující se příkazy blokem Opakuj.'}
                    </p>
                    <p className="mt-3 text-xs font-bold text-slate-500">Počet spuštění: {runner.runCount} · splnění ≠ zvládnutí</p>
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
