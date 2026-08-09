'use client';

import { useMemo, useState } from 'react';
import {
  directionGlyph,
  executeAlgorithmStep,
  initialAlgorithmState,
  isTargetReached,
  type AlgorithmCommand,
  type AlgorithmDirection,
  type AlgorithmState,
  type AlgorithmWorld,
  type GridPosition,
} from '@/lib/it-lab/algorithm-engine';

type ExecutionResult = {
  success: boolean;
  message: string;
  failedStep: number | null;
};

type Mission = {
  title: string;
  brief: string;
  objective: string;
  target: GridPosition;
  obstacles?: GridPosition[];
  expectedConcept: string;
};

const missions: Mission[] = [
  {
    title: 'Doruč balíček',
    brief: 'Sestav přesný algoritmus, který dovede robota ze startu do cíle.',
    objective: 'Dostaň robota na balíček bez opuštění arény.',
    target: { x: 2, y: 1 },
    expectedConcept: 'Pořadí příkazů a orientace robota',
  },
  {
    title: 'Obejdi překážku',
    brief: 'Přímá cesta je zablokovaná. Naplánuj objížďku a ověř ji krok po kroku.',
    objective: 'Najdi cestu kolem zdi. Nestačí jen dojít do správného řádku nebo sloupce.',
    target: { x: 2, y: 1 },
    obstacles: [{ x: 1, y: 0 }],
    expectedConcept: 'Debugging podle prvního neplatného kroku',
  },
];

const labels: Record<AlgorithmCommand, string> = {
  FORWARD: '↑ Krok',
  LEFT: '↶ Vlevo',
  RIGHT: '↷ Vpravo',
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const samePosition = (a: GridPosition, b: GridPosition) => a.x === b.x && a.y === b.y;

export default function AlgorithmLabPage() {
  const [missionIndex, setMissionIndex] = useState(0);
  const [program, setProgram] = useState<AlgorithmCommand[]>([]);
  const [state, setState] = useState<AlgorithmState>(initialAlgorithmState());
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [trail, setTrail] = useState<GridPosition[]>([{ x: 0, y: 0 }]);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(1);
  const mission = missions[missionIndex];

  const world: AlgorithmWorld = useMemo(
    () => ({ width: 4, height: 4, target: mission.target, obstacles: mission.obstacles }),
    [mission],
  );

  const progressLabel = useMemo(() => {
    if (isRunning && activeStep !== null) return `Provádím krok ${activeStep + 1} z ${program.length}`;
    if (result?.success) return 'Mise splněna';
    if (result) return 'Čeká na opravu';
    return 'Připraveno ke spuštění';
  }, [activeStep, isRunning, program.length, result]);

  const prepareEdit = (incrementAttempt = false) => {
    setState(initialAlgorithmState());
    setActiveStep(null);
    setResult(null);
    setTrail([{ x: 0, y: 0 }]);
    setExecutionLog([]);
    if (incrementAttempt) setAttempt((current) => current + 1);
  };

  const add = (command: AlgorithmCommand) => {
    if (isRunning) return;
    if (result) prepareEdit(true);
    setProgram((current) => [...current, command]);
  };

  const removeStep = (index: number) => {
    if (isRunning) return;
    prepareEdit(Boolean(result));
    setProgram((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const reset = () => {
    if (isRunning) return;
    setProgram([]);
    setAttempt(1);
    prepareEdit();
  };

  const nextMission = () => {
    if (isRunning) return;
    setMissionIndex((current) => (current + 1) % missions.length);
    setProgram([]);
    setAttempt(1);
    prepareEdit();
  };

  const runProgram = async () => {
    if (isRunning || program.length === 0) return;

    let currentState = initialAlgorithmState();
    const currentTrail: GridPosition[] = [{ ...currentState.position }];
    setState(currentState);
    setTrail(currentTrail);
    setExecutionLog([]);
    setResult(null);
    setIsRunning(true);

    for (let index = 0; index < program.length; index += 1) {
      setActiveStep(index);
      await sleep(500);

      const step = executeAlgorithmStep(currentState, program[index], world, index + 1);
      const commandLabel = labels[program[index]];

      if (!step.valid) {
        const reason = step.reason === 'OBSTACLE' ? 'kolize s překážkou' : 'opuštění arény';
        setExecutionLog((current) => [...current, `${index + 1}. ${commandLabel} → ${reason}`]);
        setActiveStep(null);
        setIsRunning(false);
        setResult({
          success: false,
          failedStep: index + 1,
          message:
            step.reason === 'OBSTACLE'
              ? `Krok ${index + 1} vede přímo do překážky. Změň rozhodnutí před tímto krokem a spusť novou verzi.`
              : `Krok ${index + 1} vede robota mimo arénu. Oprav první neplatný krok, ne celý program.`,
        });
        return;
      }

      currentState = step.state;
      setState(currentState);
      if (program[index] === 'FORWARD') {
        currentTrail.push({ ...currentState.position });
        setTrail([...currentTrail]);
      }
      setExecutionLog((current) => [
        ...current,
        `${index + 1}. ${commandLabel} → [${currentState.position.x}, ${currentState.position.y}] ${directionGlyph[currentState.direction]}`,
      ]);
    }

    await sleep(300);
    const success = isTargetReached(currentState, world);
    setActiveStep(null);
    setIsRunning(false);
    setResult({
      success,
      failedStep: success ? null : program.length,
      message: success
        ? `Robot dorazil do cíle na [${currentState.position.x}, ${currentState.position.y}]. Tato verze programu problém skutečně řeší.`
        : `Program skončil na [${currentState.position.x}, ${currentState.position.y}], ale cíl je [${mission.target.x}, ${mission.target.y}]. Porovnej execution trace se svojí předpovědí.`,
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Interactive IT Lab · Algorithm Engine</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Algorithm Lab</h1>
            <p className="mt-2 max-w-2xl text-slate-300">{mission.brief}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">Mise {missionIndex + 1}/{missions.length} · <strong className="text-white">{mission.title}</strong></div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">Verze programu <strong className="text-white">v{attempt}</strong></div>
            <div className="rounded-2xl border border-cyan-900/60 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-100">{progressLabel}</div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Robot arena</p>
                <h2 className="text-xl font-bold">Start → cíl</h2>
              </div>
              <div className="rounded-2xl bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                <span className="font-bold text-white">Cíl mise:</span> {mission.objective}
              </div>
            </div>

            <div className="grid aspect-square max-h-[580px] w-full grid-cols-4 grid-rows-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              {Array.from({ length: 16 }, (_, index) => {
                const x = index % 4;
                const y = Math.floor(index / 4);
                const position = { x, y };
                const hasRobot = samePosition(state.position, position);
                const isTarget = samePosition(mission.target, position);
                const isObstacle = mission.obstacles?.some((item) => samePosition(item, position));
                const trailIndex = trail.findIndex((item) => samePosition(item, position));
                return (
                  <div key={index} data-testid={`arena-cell-${x}-${y}`} className="relative flex items-center justify-center border border-slate-800 text-center">
                    <span className="absolute left-2 top-1 text-[10px] text-slate-700">{x},{y}</span>
                    {trailIndex >= 0 && !hasRobot && <span className="h-3 w-3 rounded-full bg-cyan-400/40" aria-label={`stopa ${trailIndex}`} />}
                    {isObstacle && <span className="text-4xl" aria-label="obstacle">🧱</span>}
                    {isTarget && <span className="text-4xl" aria-label="target">📦</span>}
                    {hasRobot && (
                      <div
                        data-testid="algorithm-robot"
                        data-x={state.position.x}
                        data-y={state.position.y}
                        data-direction={state.direction}
                        className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-400/15 shadow-lg shadow-cyan-950/40 transition-all duration-300"
                        aria-label={`robot na ${state.position.x},${state.position.y} směr ${state.direction}`}
                      >
                        <span className="text-3xl">🤖</span>
                        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300 text-lg font-black text-slate-950">{directionGlyph[state.direction]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Co právě trénuješ</p>
                <p className="mt-2 font-semibold text-slate-200">{mission.expectedConcept}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Execution trace</p>
                <div data-testid="execution-trace" className="mt-2 max-h-28 space-y-1 overflow-auto text-sm text-slate-300">
                  {executionLog.length === 0 ? <p className="text-slate-600">Po spuštění tady uvidíš skutečný průběh programu.</p> : executionLog.map((entry) => <p key={entry}>{entry}</p>)}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">1 · Naplánuj a sestav</p>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">bez časového skóre</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">Nejdřív si představ cestu. Pak sestav program a teprve potom ho spusť.</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(Object.keys(labels) as AlgorithmCommand[]).map((command) => (
                  <button key={command} disabled={isRunning} onClick={() => add(command)} className="rounded-xl bg-slate-800 px-3 py-3 font-bold transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                    {labels[command]}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">2 · Program v{attempt}</p>
                <button disabled={isRunning} onClick={reset} className="text-sm font-semibold text-slate-400 hover:text-white disabled:opacity-40">Vymazat vše</button>
              </div>
              <div data-testid="algorithm-program" className="mt-4 min-h-28 rounded-2xl bg-slate-950 p-3">
                {program.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">Přidej první příkaz. Cílem není hádat, ale navrhnout postup.</p>
                ) : (
                  <ol className="space-y-2">
                    {program.map((command, index) => (
                      <li key={`${command}-${index}`} data-testid={`algorithm-step-${index + 1}`} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${activeStep === index ? 'bg-cyan-400 text-slate-950 ring-2 ring-cyan-200' : 'bg-slate-900'}`}>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${activeStep === index ? 'bg-slate-950/15 text-slate-950' : 'bg-cyan-400/10 text-cyan-300'}`}>{index + 1}</span>
                        <span className="font-semibold">{labels[command]}</span>
                        {activeStep === index ? <span className="ml-auto text-xs font-black uppercase tracking-wide">právě běží</span> : (
                          <button disabled={isRunning} onClick={() => removeStep(index)} aria-label={`Odstranit krok ${index + 1}`} className="ml-auto rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-white">Odstranit</button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <button onClick={runProgram} disabled={program.length === 0 || isRunning} className="mt-4 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
                {isRunning ? 'Provádím algoritmus…' : '▶ Spustit program krok po kroku'}
              </button>
            </div>

            {result && (
              <div data-testid="algorithm-result" className={`rounded-3xl border p-5 ${result.success ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">3 · Diagnóza a evidence</p>
                <h3 className="mt-2 text-xl font-black">{result.success ? 'Algoritmus funguje.' : 'Tahle verze ještě nefunguje.'}</h3>
                <p className="mt-2 text-sm text-slate-300">{result.message}</p>
                {!result.success && result.failedStep && <p className="mt-3 rounded-xl bg-slate-950/40 px-3 py-2 text-sm font-semibold text-amber-100">Diagnostický bod: krok {result.failedStep}. Oprav hypotézu, nehádej celý program znovu.</p>}
                {result.success && <button onClick={nextMission} className="mt-4 rounded-xl bg-white px-4 py-2 font-bold text-slate-950">Transfer: další mise →</button>}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
