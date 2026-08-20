'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type JSX } from 'react';
import {
  Bug,
  CheckCircle2,
  ChevronLeft,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  StepForward,
  Wrench,
} from 'lucide-react';
import { AnimatedRobotArena } from '@/components/it-lab/animated-robot-arena';
import {
  executeBlockProgram,
  type BlockExecutionStep,
  type BlockProgramNode,
  type BlockProgramResult,
} from '@/lib/it-lab/block-program-engine';
import { useBlockProgramRunner } from '@/lib/it-lab/use-block-program-runner';
import {
  directionGlyph,
  type AlgorithmCommand,
  type AlgorithmWorld,
  type GridPosition,
} from '@/lib/it-lab/algorithm-engine';

type Hypothesis = 'EXTRA_REPEAT' | 'WRONG_TURN' | 'MISSING_FORWARD';

const world: AlgorithmWorld = {
  width: 5,
  height: 3,
  target: { x: 4, y: 2 },
  obstacles: [{ x: 4, y: 0 }],
};

const transferWorld: AlgorithmWorld = {
  width: 5,
  height: 1,
  target: { x: 3, y: 0 },
  obstacles: [{ x: 4, y: 0 }],
};

const commandLabel: Record<AlgorithmCommand, string> = {
  FORWARD: 'Krok vpřed',
  LEFT: 'Otoč vlevo',
  RIGHT: 'Otoč vpravo',
};

const hypothesisCopy: Array<{ value: Hypothesis; label: string }> = [
  { value: 'EXTRA_REPEAT', label: 'Smyčka se opakuje jednou navíc.' },
  { value: 'WRONG_TURN', label: 'První otočení má být doleva.' },
  { value: 'MISSING_FORWARD', label: 'Po otočení chybí ještě jeden krok vpřed.' },
];

function createBrokenProgram(): BlockProgramNode[] {
  return [
    {
      type: 'REPEAT',
      count: 4,
      body: [{ type: 'COMMAND', command: 'FORWARD' }],
    },
    { type: 'COMMAND', command: 'RIGHT' },
    { type: 'COMMAND', command: 'FORWARD' },
    { type: 'COMMAND', command: 'FORWARD' },
    { type: 'COMMAND', command: 'LEFT' },
    { type: 'COMMAND', command: 'FORWARD' },
  ];
}

function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function repeatCount(program: BlockProgramNode[]): number {
  const first = program[0];
  return first?.type === 'REPEAT' ? first.count : 0;
}

function formatProvenance(step: BlockExecutionStep): string {
  if (step.nodePath.length === 0) return 'program';

  const labels = [`blok ${step.nodePath[0]! + 1}`];
  for (let depth = 1; depth < step.nodePath.length; depth += 1) {
    const iteration = step.iterationPath[depth - 1];
    if (iteration !== undefined) labels.push(`opakování ${iteration + 1}`);

    const nodeIndex = step.nodePath[depth]! + 1;
    labels.push(depth === step.nodePath.length - 1 ? `příkaz ${nodeIndex}` : `blok smyčky ${nodeIndex}`);
  }

  return labels.join(' · ');
}

function transferProgram(answer: number): BlockProgramNode[] {
  return [
    {
      type: 'REPEAT',
      count: answer,
      body: [{ type: 'COMMAND', command: 'FORWARD' }],
    },
  ];
}

export default function BlockProgrammingDebugPage(): JSX.Element {
  const [program, setProgram] = useState<BlockProgramNode[]>(createBrokenProgram);
  const [failureEvidence, setFailureEvidence] = useState<BlockProgramResult | null>(null);
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);
  const [transferAnswer, setTransferAnswer] = useState<number | null>(null);
  const runner = useBlockProgramRunner(program, world);

  useEffect(() => {
    if (runner.result?.failureType === 'WORLD_RULE') {
      setFailureEvidence(runner.result);
    }
  }, [runner.result]);

  const count = repeatCount(program);
  const diagnosisCorrect = hypothesis === 'EXTRA_REPEAT';
  const repaired = count === 3;
  const missionSolved = Boolean(runner.result?.valid && samePosition(runner.result.state.position, world.target));
  const currentFailure = runner.result?.failureType === 'WORLD_RULE' ? runner.result : failureEvidence;
  const failedStep = currentFailure?.steps.at(-1) ?? null;
  const traceSteps = runner.status === 'IDLE' ? failureEvidence?.steps ?? [] : runner.visibleSteps;
  const activeTopLevelIndex = runner.activeStep?.nodePath[0] ?? null;
  const activeNestedIndex = runner.activeStep?.nodePath[1] ?? null;
  const activeIteration = runner.activeStep?.iterationPath[0] ?? null;

  const transferResult = useMemo(() => {
    if (transferAnswer === null) return null;
    return executeBlockProgram(transferProgram(transferAnswer), transferWorld);
  }, [transferAnswer]);

  const transferSolved = Boolean(
    transferAnswer === 3
      && transferResult?.valid
      && samePosition(transferResult.state.position, transferWorld.target),
  );
  const mastery = missionSolved && diagnosisCorrect && transferSolved;

  function changeRepeat(delta: number): void {
    if (!diagnosisCorrect || runner.isRunning) return;
    runner.resetPlayback();
    setProgram((current) => current.map((node, index) => {
      if (index !== 0 || node.type !== 'REPEAT') return node;
      return { ...node, count: Math.max(1, Math.min(12, node.count + delta)) };
    }));
    setTransferAnswer(null);
  }

  function reset(): void {
    setProgram(createBrokenProgram());
    setFailureEvidence(null);
    setHypothesis(null);
    setTransferAnswer(null);
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
        <header className="mb-6">
          <Link href="/app/labs/algorithm-lab/block-programming" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Loop Mission
          </Link>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">IT-2 · Debug Lab</p>
              <h1 className="mt-2 text-3xl font-black sm:text-5xl">Broken Loop</h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Program už někdo napsal — ale robot narazí do zdi. Sleduj každý vykonaný příkaz, najdi důkaz v trace, vyslov hypotézu a až potom oprav zdrojový blok.
              </p>
            </div>
            <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100">
              <strong>{runner.runCount}</strong> spuštění · <strong>{mastery ? 'ověřeno' : missionSolved ? 'transfer zbývá' : 'debugging'}</strong>
            </div>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-5">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">1 · Pozoruj</p>
                  <h2 className="mt-1 text-xl font-black">Robot arena</h2>
                </div>
                <span data-testid="debug-runner-status" className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">{runnerStatus}</span>
              </div>

              <AnimatedRobotArena
                accent="rose"
                impact={Boolean(runner.activeStep && !runner.activeStep.valid)}
                state={runner.state}
                testIdPrefix="debug"
                world={world}
              />

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <button data-testid="debug-run" disabled={runner.isRunning} onClick={runner.run} className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                  <Play className="h-4 w-4" aria-hidden="true" /> {runner.status === 'COMPLETE' ? 'Spustit znovu' : 'Spustit algoritmus'}
                </button>
                <button data-testid="debug-pause" disabled={runner.status === 'IDLE' || runner.status === 'COMPLETE'} onClick={runner.togglePause} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black disabled:opacity-35">
                  {runner.isRunning ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  {runner.isRunning ? 'Pauza' : 'Pokračovat'}
                </button>
                <button data-testid="debug-step" disabled={runner.isRunning} onClick={runner.step} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black disabled:opacity-35">
                  <StepForward className="h-4 w-4" aria-hidden="true" /> Krok
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950/55 px-4 py-3 text-xs text-slate-400">
                <span>Rychlost simulace</span>
                <div className="flex gap-2">
                  {([
                    ['SLOW', '0.5×', 'debug-speed-slow'],
                    ['NORMAL', '1×', 'debug-speed-normal'],
                    ['FAST', '2×', 'debug-speed-fast'],
                  ] as const).map(([value, label, testId]) => (
                    <button key={value} data-testid={testId} onClick={() => runner.setSpeed(value)} className={`rounded-lg px-3 py-1.5 font-black ${runner.speed === value ? 'bg-cyan-300 text-slate-950' : 'bg-white/5 text-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Execution trace</p>
                  <h2 className="text-lg font-black">Trace vzniká spolu s během</h2>
                </div>
              </div>

              <div data-testid="debug-trace" className="mt-4 max-h-72 space-y-2 overflow-auto rounded-2xl bg-slate-950/70 p-3">
                {traceSteps.length === 0 ? (
                  <p className="p-2 text-sm text-slate-500">Spusť program nebo použij Krok. Každý řádek se objeví až po skutečném vykonání příkazu.</p>
                ) : traceSteps.map((step) => (
                  <div
                    key={`${step.stepNumber}-${step.sourcePath.join('.')}`}
                    data-testid={`debug-trace-step-${step.stepNumber}`}
                    className={`rounded-xl border px-3 py-2 text-sm ${step.valid ? 'border-white/5 bg-white/[0.025] text-slate-300' : 'border-rose-300/30 bg-rose-300/10 text-rose-100'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">{step.stepNumber}. {commandLabel[step.command]} → [{step.state.position.x},{step.state.position.y}] {directionGlyph[step.state.direction]}</span>
                      <span className="text-xs font-black uppercase tracking-[0.12em]">{step.valid ? 'OK' : step.reason}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Zdroj: {formatProvenance(step)}</p>
                  </div>
                ))}
              </div>

              {failedStep && (
                <div data-testid="debug-failure-evidence" className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">
                  <strong>{missionSolved ? 'Původní breakpoint:' : 'Breakpoint:'}</strong> krok {failedStep.stepNumber} vznikl ze zdroje <strong>{formatProvenance(failedStep)}</strong> a skončil stavem <strong>{failedStep.reason}</strong>.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Bug className="h-5 w-5 text-rose-300" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">2 · Lokalizuj</p>
                    <h2 className="text-lg font-black">Zdrojový program</h2>
                  </div>
                </div>
                <button onClick={reset} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
                </button>
              </div>

              {runner.activeStep && (
                <p data-testid="debug-active-source" className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                  Právě běží: {formatProvenance(runner.activeStep)}
                </p>
              )}

              <div data-testid="debug-program" className="mt-4 space-y-2 rounded-2xl bg-slate-950/70 p-3">
                {program.map((node, index) => {
                  const isActive = activeTopLevelIndex === index;
                  const isFailureSource = failureEvidence?.steps.at(-1)?.nodePath[0] === index;

                  if (node.type === 'COMMAND') {
                    return (
                      <div key={index} className={`rounded-xl border px-3 py-3 font-bold transition ${isActive ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-50 ring-2 ring-cyan-300/20' : 'border-white/5 bg-slate-900 text-slate-300'}`}>
                        <span className="mr-3 text-xs text-slate-600">{index + 1}</span>{commandLabel[node.command]}
                      </div>
                    );
                  }

                  const sourceClass = isActive
                    ? 'border-cyan-300/60 bg-cyan-300/15 ring-2 ring-cyan-300/20'
                    : isFailureSource
                      ? missionSolved
                        ? 'border-emerald-300/35 bg-emerald-300/10'
                        : 'border-rose-300/40 bg-rose-300/10'
                      : 'border-violet-300/20 bg-violet-300/10';

                  return (
                    <div key={index} data-testid="debug-repeat-block" className={`rounded-2xl border p-3 transition ${sourceClass}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="mr-3 text-xs text-slate-500">{index + 1}</span>
                          <strong>Opakuj <span data-testid="debug-repeat-count">{node.count}×</span></strong>
                          {isActive && activeIteration !== null && (
                            <span data-testid="debug-active-iteration" className="ml-3 rounded-full bg-cyan-200/15 px-2 py-1 text-xs text-cyan-100">opakování {activeIteration + 1}/{node.count}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button data-testid="debug-repeat-minus" aria-label="Snížit počet opakování" disabled={!diagnosisCorrect || runner.isRunning} onClick={() => changeRepeat(-1)} className="rounded-lg bg-slate-950/60 p-1.5 disabled:cursor-not-allowed disabled:opacity-30">
                            <Minus className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button data-testid="debug-repeat-plus" aria-label="Zvýšit počet opakování" disabled={!diagnosisCorrect || runner.isRunning} onClick={() => changeRepeat(1)} className="rounded-lg bg-slate-950/60 p-1.5 disabled:cursor-not-allowed disabled:opacity-30">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className={`mt-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${isActive && activeNestedIndex === 0 ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-50' : 'border-transparent bg-slate-950/50 text-violet-100'}`}>
                        ↳ Krok vpřed
                      </div>
                      {isFailureSource && !isActive && (
                        <p className={`mt-2 text-xs font-bold ${missionSolved ? 'text-emerald-200' : 'text-rose-200'}`}>
                          {missionSolved ? 'Původní chyba vznikla v tomto bloku. Oprava je ověřena.' : 'Trace ukazuje na tento zdrojový blok.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center gap-3">
                <Wrench className="h-5 w-5 text-amber-200" aria-hidden="true" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">3 · Hypotéza → oprava</p>
                  <h2 className="text-lg font-black">Proč program selhal?</h2>
                </div>
              </div>

              {!failureEvidence ? (
                <p className="mt-4 rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-500">Hypotézu vybírej až poté, co se běh zastaví na konkrétní chybě.</p>
              ) : (
                <div className="mt-4 space-y-2" data-testid="debug-hypotheses">
                  {hypothesisCopy.map((option) => (
                    <button key={option.value} data-testid={`debug-hypothesis-${option.value.toLowerCase()}`} onClick={() => setHypothesis(option.value)} className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${hypothesis === option.value ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-50' : 'border-white/10 bg-slate-950/50 text-slate-300 hover:border-white/20'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {hypothesis && (
                <div data-testid="debug-diagnosis" className={`mt-3 rounded-2xl border p-4 text-sm ${diagnosisCorrect ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/25 bg-amber-300/10 text-amber-100'}`}>
                  {diagnosisCorrect
                    ? 'Diagnóza sedí s trace: čtvrté opakování stejného příkazu míří do zdi. Teď oprav počet opakování ve zvýrazněném zdrojovém bloku.'
                    : 'Tahle hypotéza nevysvětluje, proč chyba vznikla už ve 4. vykonaném kroku. Vrať se k označenému zdroji v trace.'}
                </div>
              )}

              {diagnosisCorrect && (
                <p data-testid="debug-repair-status" className="mt-3 text-sm font-bold text-slate-300">
                  Aktuální oprava: Opakuj {count}× · {repaired ? 'připraveno k ověření' : 'změň počet tak, aby robot skončil před zdí'}
                </p>
              )}
            </div>

            {missionSolved && (
              <div className="rounded-[30px] border border-emerald-300/25 bg-emerald-300/10 p-5" data-testid="debug-mission-success">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-200" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200/70">Oprava ověřena</p>
                    <h2 className="mt-1 text-xl font-black">Program už funguje.</h2>
                    <p className="mt-2 text-sm text-emerald-50/80">Viděl jsi celý opravený běh krok po kroku. Poslední úloha teď ověří, jestli rozumíš principu i mimo původní trasu.</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-950/45 p-4">
                  <p className="font-black">Nová chodba</p>
                  <p className="mt-1 text-sm text-slate-300">Robot stojí na [0,0], cíl je [3,0] a zeď je až na [4,0]. Kolikrát má smyčka opakovat „Krok vpřed“?</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[2, 3, 4].map((answer) => (
                      <button key={answer} data-testid={`debug-transfer-${answer}`} onClick={() => setTransferAnswer(answer)} className={`rounded-xl border px-3 py-2 font-black ${transferAnswer === answer ? 'border-emerald-200/50 bg-emerald-200/15' : 'border-white/10 bg-slate-950/50'}`}>
                        {answer}×
                      </button>
                    ))}
                  </div>
                  {transferResult && (
                    <p data-testid="debug-transfer-result" className={`mt-3 text-sm font-bold ${transferSolved ? 'text-emerald-200' : 'text-amber-200'}`}>
                      {transferSolved
                        ? 'Správně: tři kroky dovedou robota přesně do cíle a čtvrtý by už narazil do zdi.'
                        : transferResult.failureReason === 'OBSTACLE'
                          ? 'Příliš mnoho opakování: poslední krok míří do zdi.'
                          : `Robot skončil na [${transferResult.state.position.x},${transferResult.state.position.y}], tedy ještě před cílem.`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {mastery && (
              <div data-testid="debug-mastery" className="rounded-[30px] border border-violet-300/30 bg-violet-300/10 p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-violet-200" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200/70">IT-2 · Debugging evidence</p>
                    <h2 className="mt-1 text-xl font-black">Princip ověřen na změněné situaci.</h2>
                    <p className="mt-2 text-sm text-slate-300">Našel jsi chybu během vykonávání, opravil její zdroj a stejný princip použil i bez původní trasy.</p>
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
