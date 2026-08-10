'use client';

import { useMemo, useState, type JSX } from 'react';
import {
  directionGlyph,
  executeAlgorithmStep,
  initialAlgorithmState,
  type AlgorithmCommand,
  type AlgorithmDirection,
  type AlgorithmState,
  type AlgorithmWorld,
  type GridPosition,
} from '@/lib/it-lab/algorithm-engine';

const traceProgram: AlgorithmCommand[] = ['FORWARD', 'RIGHT', 'FORWARD', 'LEFT', 'FORWARD'];
const debugProgram: AlgorithmCommand[] = ['FORWARD', 'FORWARD', 'RIGHT', 'FORWARD'];
const directions: AlgorithmDirection[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const labels: Record<AlgorithmCommand, string> = {
  FORWARD: '↑ Krok',
  LEFT: '↶ Vlevo',
  RIGHT: '↷ Vpravo',
};

const world: AlgorithmWorld = {
  width: 4,
  height: 4,
  target: { x: 2, y: 1 },
};

const debugWorld: AlgorithmWorld = {
  width: 4,
  height: 4,
  target: { x: 2, y: 1 },
  obstacles: [{ x: 2, y: 0 }],
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const samePosition = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;

type Phase = 'PREDICT' | 'TRACE' | 'DEBUG';

type Prediction = {
  position: GridPosition;
  direction: AlgorithmDirection;
};

type TraceResult = {
  state: AlgorithmState;
  matched: boolean;
};

export default function AlgorithmTracingPage(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('PREDICT');
  const [prediction, setPrediction] = useState<Prediction>({
    position: { x: 2, y: 1 },
    direction: 'EAST',
  });
  const [predictionLocked, setPredictionLocked] = useState(false);
  const [state, setState] = useState<AlgorithmState>(initialAlgorithmState());
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [traceLog, setTraceLog] = useState<string[]>([]);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [debugHypothesis, setDebugHypothesis] = useState<number | null>(null);
  const [debugActual, setDebugActual] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const signalProgress = useMemo(() => {
    let value = 0;
    if (predictionLocked) value += 34;
    if (traceResult) value += 33;
    if (debugActual !== null) value += 33;
    return value;
  }, [debugActual, predictionLocked, traceResult]);

  async function runTrace(): Promise<void> {
    if (!predictionLocked || running) return;
    setPhase('TRACE');
    setRunning(true);
    setTraceLog([]);
    setTraceResult(null);
    let current = initialAlgorithmState();
    setState(current);

    for (let index = 0; index < traceProgram.length; index += 1) {
      const command = traceProgram[index];
      if (!command) continue;
      setActiveStep(index);
      await sleep(450);
      const step = executeAlgorithmStep(current, command, world, index + 1);
      current = step.state;
      setState(current);
      setTraceLog((items) => [
        ...items,
        `${index + 1}. ${labels[command]} → [${current.position.x}, ${current.position.y}] ${directionGlyph[current.direction]}`,
      ]);
    }

    setActiveStep(null);
    setRunning(false);
    setTraceResult({
      state: current,
      matched: samePosition(current.position, prediction.position) && current.direction === prediction.direction,
    });
  }

  async function verifyDebugHypothesis(): Promise<void> {
    if (debugHypothesis === null || running) return;
    setRunning(true);
    setDebugActual(null);
    let current = initialAlgorithmState();

    for (let index = 0; index < debugProgram.length; index += 1) {
      const command = debugProgram[index];
      if (!command) continue;
      setActiveStep(index);
      await sleep(400);
      const step = executeAlgorithmStep(current, command, debugWorld, index + 1);
      if (!step.valid) {
        setDebugActual(index + 1);
        setActiveStep(null);
        setRunning(false);
        return;
      }
      current = step.state;
    }

    setDebugActual(debugProgram.length);
    setActiveStep(null);
    setRunning(false);
  }

  function startDebug(): void {
    setPhase('DEBUG');
    setState(initialAlgorithmState());
    setActiveStep(null);
  }

  return (
    <main className="min-h-[100dvh] bg-[#06101e] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300/70">IT-1 · Algorithm Lab</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">Trace & Debug Mission</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
              Nejdřív předpověz, co program udělá. Potom sleduj skutečný běh krok po kroku a nakonec najdi první chybný krok v cizím programu.
            </p>
          </div>
          <div className="w-full rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 lg:w-80" data-testid="trace-signal-core">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/60">Signal Core</p>
                <p className="mt-1 font-black">Proces mise</p>
              </div>
              <strong className="text-2xl text-cyan-200">{signalProgress}%</strong>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900">
              <div className="h-full rounded-full bg-cyan-300 transition-all duration-500" style={{ width: `${signalProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Postup roste za predikci, sledování trace a ověření hypotézy — ne za rychlost.</p>
          </div>
        </header>

        <div className="mt-7 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Robot arena</p>
                <h2 className="mt-1 text-xl font-black">Program musíš nejdřív číst hlavou</h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-400">bez leaderboardu</span>
            </div>

            <div className="mt-5 grid aspect-square max-h-[620px] grid-cols-4 grid-rows-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
              {Array.from({ length: 16 }, (_, index) => {
                const position = { x: index % 4, y: Math.floor(index / 4) };
                const robot = samePosition(state.position, position);
                const predicted = predictionLocked && samePosition(prediction.position, position);
                const target = samePosition(world.target, position);
                const debugObstacle = phase === 'DEBUG' && debugWorld.obstacles?.some((item) => samePosition(item, position));
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={predictionLocked || phase !== 'PREDICT'}
                    onClick={() => setPrediction((current) => ({ ...current, position }))}
                    data-testid={`trace-cell-${position.x}-${position.y}`}
                    className="relative flex items-center justify-center border border-slate-800 transition enabled:hover:bg-cyan-300/[0.06] disabled:cursor-default"
                    aria-label={`Pole ${position.x},${position.y}`}
                  >
                    <span className="absolute left-2 top-1 text-[10px] text-slate-700">{position.x},{position.y}</span>
                    {target && phase !== 'DEBUG' && <span className="text-3xl" aria-label="target">📦</span>}
                    {debugObstacle && <span className="text-3xl" aria-label="obstacle">🧱</span>}
                    {predicted && !robot && (
                      <span className="absolute inset-2 rounded-2xl border-2 border-dashed border-violet-300/50 bg-violet-300/5" aria-label="predicted endpoint" />
                    )}
                    {robot && (
                      <div
                        data-testid="trace-robot"
                        data-x={state.position.x}
                        data-y={state.position.y}
                        data-direction={state.direction}
                        className="absolute z-10 grid h-16 w-16 place-items-center rounded-2xl border border-cyan-200/40 bg-cyan-300/10 shadow-xl shadow-cyan-950/50 transition-all duration-300"
                      >
                        <span className="text-3xl">🤖</span>
                        <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-cyan-200 font-black text-slate-950">{directionGlyph[state.direction]}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-5">
            {phase !== 'DEBUG' && (
              <>
                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300/70">1 · Předpověď</p>
                  <h2 className="mt-2 text-xl font-black">Kam robot skončí?</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Klikni na cílové pole a nastav směr. Až potom predikci zamkni. Běh programu se ti předem neukáže.</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {directions.map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        disabled={predictionLocked}
                        onClick={() => setPrediction((current) => ({ ...current, direction }))}
                        data-testid={`trace-direction-${direction}`}
                        className={`grid h-11 w-11 place-items-center rounded-xl border text-lg font-black transition ${prediction.direction === direction ? 'border-violet-200 bg-violet-300 text-slate-950' : 'border-white/10 bg-slate-950 text-slate-300'}`}
                      >
                        {directionGlyph[direction]}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    data-testid="trace-lock-prediction"
                    onClick={() => setPredictionLocked(true)}
                    disabled={predictionLocked}
                    className="mt-4 w-full rounded-2xl bg-violet-300 px-4 py-3 font-black text-slate-950 transition hover:bg-violet-200 disabled:opacity-50"
                  >
                    {predictionLocked ? `Predikce zamčena · [${prediction.position.x}, ${prediction.position.y}] ${directionGlyph[prediction.direction]}` : 'Zamknout předpověď'}
                  </button>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300/70">2 · Trace</p>
                  <div className="mt-3 flex flex-wrap gap-2" data-testid="trace-program">
                    {traceProgram.map((command, index) => (
                      <span key={`${command}-${index}`} className={`rounded-xl border px-3 py-2 text-sm font-black transition ${activeStep === index ? 'border-cyan-100 bg-cyan-300 text-slate-950' : 'border-white/10 bg-slate-950 text-slate-300'}`}>
                        {index + 1}. {labels[command]}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void runTrace()}
                    disabled={!predictionLocked || running || Boolean(traceResult)}
                    data-testid="trace-run"
                    className="mt-4 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-40"
                  >
                    {running ? 'Provádím trace…' : '▶ Spustit a porovnat'}
                  </button>
                  <div className="mt-4 max-h-36 space-y-1 overflow-auto rounded-2xl bg-slate-950 p-3 text-sm text-slate-400" data-testid="trace-log">
                    {traceLog.length ? traceLog.map((entry) => <p key={entry}>{entry}</p>) : <p>Trace se zobrazí až po spuštění.</p>}
                  </div>
                </div>

                {traceResult && (
                  <div className={`rounded-[28px] border p-5 ${traceResult.matched ? 'border-emerald-300/30 bg-emerald-300/[0.08]' : 'border-amber-300/30 bg-amber-300/[0.08]'}`} data-testid="trace-result">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">3 · Porovnání modelu s realitou</p>
                    <h3 className="mt-2 text-xl font-black">{traceResult.matched ? 'Predikce sedí.' : 'Predikce a běh se rozešly.'}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Předpověď: [{prediction.position.x}, {prediction.position.y}] {directionGlyph[prediction.direction]} · skutečnost: [{traceResult.state.position.x}, {traceResult.state.position.y}] {directionGlyph[traceResult.state.direction]}.
                    </p>
                    <button type="button" onClick={startDebug} data-testid="trace-start-debug" className="mt-4 rounded-xl bg-white px-4 py-2 font-black text-slate-950">Debug challenge →</button>
                  </div>
                )}
              </>
            )}

            {phase === 'DEBUG' && (
              <div className="rounded-[28px] border border-rose-300/20 bg-rose-300/[0.04] p-5" data-testid="debug-challenge">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-200/70">4 · Debug hypotéza</p>
                <h2 className="mt-2 text-2xl font-black">Který krok selže jako první?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">V aréně je zeď na [2,0]. Nehádej opravu. Nejdřív označ první krok, kde se program rozbije, a potom hypotézu ověř během.</p>
                <div className="mt-4 space-y-2">
                  {debugProgram.map((command, index) => (
                    <button
                      key={`${command}-${index}`}
                      type="button"
                      disabled={running || debugActual !== null}
                      onClick={() => setDebugHypothesis(index + 1)}
                      data-testid={`debug-step-${index + 1}`}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${debugHypothesis === index + 1 ? 'border-rose-200 bg-rose-300 text-slate-950' : 'border-white/10 bg-slate-950 text-slate-300'}`}
                    >
                      <span className="font-black">{index + 1}. {labels[command]}</span>
                      <span className="text-xs font-bold">označit jako první chybu</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => void verifyDebugHypothesis()} disabled={debugHypothesis === null || running || debugActual !== null} data-testid="debug-verify" className="mt-4 w-full rounded-2xl bg-rose-200 px-4 py-3 font-black text-slate-950 disabled:opacity-40">
                  {running ? 'Ověřuji hypotézu…' : '▶ Ověřit během programu'}
                </button>
                {debugActual !== null && (
                  <div className="mt-4 rounded-2xl bg-slate-950 p-4" data-testid="debug-result">
                    <p className="font-black">První neplatný krok je {debugActual}.</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {debugHypothesis === debugActual ? 'Tvoje hypotéza odpovídala skutečnému execution trace.' : `Ty jsi označil krok ${debugHypothesis}. Teď už přesně víš, kde se mentální model rozešel s během.`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
