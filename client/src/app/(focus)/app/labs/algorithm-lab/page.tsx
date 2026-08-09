'use client';

import { useMemo, useState } from 'react';

type Command = 'FORWARD' | 'LEFT' | 'RIGHT';
type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
type Position = { x: number; y: number };
type ExecutionResult = {
  success: boolean;
  message: string;
  failedStep: number | null;
};

type Mission = {
  title: string;
  brief: string;
  target: Position;
  obstacle?: Position;
  blocks: Command[];
};

const missions: Mission[] = [
  {
    title: 'Doruč balíček',
    brief: 'Sestav přesný algoritmus, který dovede robota ze startu do cíle.',
    target: { x: 2, y: 1 },
    blocks: ['FORWARD', 'FORWARD', 'RIGHT', 'FORWARD'],
  },
  {
    title: 'Obejdi překážku',
    brief: 'Přímá cesta je zablokovaná. Naplánuj objížďku a ověř ji krok po kroku.',
    target: { x: 2, y: 1 },
    obstacle: { x: 1, y: 0 },
    blocks: ['RIGHT', 'FORWARD', 'LEFT', 'FORWARD', 'FORWARD'],
  },
];

const labels: Record<Command, string> = {
  FORWARD: '↑ Krok',
  LEFT: '↶ Vlevo',
  RIGHT: '↷ Vpravo',
};

const directionGlyph: Record<Direction, string> = {
  NORTH: '↑',
  EAST: '→',
  SOUTH: '↓',
  WEST: '←',
};

const turnLeft: Record<Direction, Direction> = {
  NORTH: 'WEST',
  WEST: 'SOUTH',
  SOUTH: 'EAST',
  EAST: 'NORTH',
};

const turnRight: Record<Direction, Direction> = {
  NORTH: 'EAST',
  EAST: 'SOUTH',
  SOUTH: 'WEST',
  WEST: 'NORTH',
};

const vector: Record<Direction, Position> = {
  NORTH: { x: 0, y: -1 },
  EAST: { x: 1, y: 0 },
  SOUTH: { x: 0, y: 1 },
  WEST: { x: -1, y: 0 },
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function AlgorithmLabPage() {
  const [missionIndex, setMissionIndex] = useState(0);
  const [program, setProgram] = useState<Command[]>([]);
  const [robot, setRobot] = useState<Position>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>('EAST');
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const mission = missions[missionIndex];

  const progressLabel = useMemo(() => {
    if (isRunning && activeStep !== null) return `Provádím krok ${activeStep + 1} z ${program.length}`;
    if (result?.success) return 'Mise splněna';
    return 'Připraveno ke spuštění';
  }, [activeStep, isRunning, program.length, result]);

  const prepareEdit = () => {
    setRobot({ x: 0, y: 0 });
    setDirection('EAST');
    setActiveStep(null);
    setResult(null);
  };

  const add = (command: Command) => {
    if (isRunning) return;
    prepareEdit();
    setProgram((current) => [...current, command]);
  };

  const reset = () => {
    if (isRunning) return;
    setProgram([]);
    prepareEdit();
  };

  const nextMission = () => {
    if (isRunning) return;
    setMissionIndex((current) => (current + 1) % missions.length);
    setProgram([]);
    prepareEdit();
  };

  const runProgram = async () => {
    if (isRunning || program.length === 0) return;

    let position = { x: 0, y: 0 };
    let facing: Direction = 'EAST';
    setRobot(position);
    setDirection(facing);
    setResult(null);
    setIsRunning(true);

    for (let index = 0; index < program.length; index += 1) {
      const command = program[index];
      setActiveStep(index);
      await sleep(450);

      if (command === 'LEFT') {
        facing = turnLeft[facing];
        setDirection(facing);
        continue;
      }

      if (command === 'RIGHT') {
        facing = turnRight[facing];
        setDirection(facing);
        continue;
      }

      const delta = vector[facing];
      const next = { x: position.x + delta.x, y: position.y + delta.y };
      const outside = next.x < 0 || next.x > 3 || next.y < 0 || next.y > 3;
      const hitsObstacle = mission.obstacle?.x === next.x && mission.obstacle?.y === next.y;

      if (outside || hitsObstacle) {
        setActiveStep(null);
        setIsRunning(false);
        setResult({
          success: false,
          failedStep: index + 1,
          message: outside
            ? `Krok ${index + 1} vede robota mimo arénu. Oprav první neplatný krok, ne celý program.`
            : `Krok ${index + 1} vede přímo do překážky. Zkus změnit směr ještě před tímto krokem.`,
        });
        return;
      }

      position = next;
      setRobot(position);
    }

    await sleep(300);
    const success = position.x === mission.target.x && position.y === mission.target.y;
    setActiveStep(null);
    setIsRunning(false);
    setResult({
      success,
      failedStep: success ? null : program.length,
      message: success
        ? `Robot dorazil do cíle na [${position.x}, ${position.y}]. Máš důkaz, že tvoje posloupnost řeší zadaný problém.`
        : `Program skončil na [${position.x}, ${position.y}], ale cíl je [${mission.target.x}, ${mission.target.y}]. Najdi první krok, po kterém už cesta nemůže vést do cíle.`,
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Interactive IT Lab · IT-1 prototype</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Algorithm Lab</h1>
            <p className="mt-2 max-w-2xl text-slate-300">{mission.brief}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            Mise {missionIndex + 1}/{missions.length} · {mission.title}
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Robot arena</p>
                <h2 className="text-xl font-bold">Start → cíl</h2>
              </div>
              <div className="flex items-center gap-2">
                <span data-testid="execution-status" className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">{progressLabel}</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">bez časového skóre</span>
              </div>
            </div>

            <div className="grid aspect-square max-h-[520px] w-full grid-cols-4 grid-rows-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              {Array.from({ length: 16 }, (_, index) => {
                const x = index % 4;
                const y = Math.floor(index / 4);
                const hasRobot = robot.x === x && robot.y === y;
                const isTarget = x === mission.target.x && y === mission.target.y;
                const isObstacle = mission.obstacle?.x === x && mission.obstacle?.y === y;
                return (
                  <div key={index} className="relative flex items-center justify-center border border-slate-800 text-center">
                    <span className="absolute left-2 top-1 text-[10px] text-slate-700">{x},{y}</span>
                    {isObstacle && <span className="text-4xl" aria-label="obstacle">🧱</span>}
                    {isTarget && <span className="text-4xl" aria-label="target">📦</span>}
                    {hasRobot && (
                      <div
                        data-testid="algorithm-robot"
                        data-x={robot.x}
                        data-y={robot.y}
                        data-direction={direction}
                        className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-400/15 shadow-lg shadow-cyan-950/40 transition-all duration-300"
                        aria-label={`robot na ${robot.x},${robot.y} směr ${direction}`}
                      >
                        <span className="text-3xl">🤖</span>
                        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300 text-lg font-black text-slate-950">{directionGlyph[direction]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">1 · Sestav algoritmus</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(Object.keys(labels) as Command[]).map((command) => (
                  <button key={command} disabled={isRunning} onClick={() => add(command)} className="rounded-xl bg-slate-800 px-3 py-3 font-bold transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                    {labels[command]}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">2 · Program</p>
                <button disabled={isRunning} onClick={reset} className="text-sm font-semibold text-slate-400 hover:text-white disabled:opacity-40">Vymazat</button>
              </div>
              <div data-testid="algorithm-program" className="mt-4 min-h-28 rounded-2xl bg-slate-950 p-3">
                {program.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">Přidej první příkaz. Nejdřív si ale cestu zkus naplánovat.</p>
                ) : (
                  <ol className="space-y-2">
                    {program.map((command, index) => (
                      <li
                        key={`${command}-${index}`}
                        data-testid={`algorithm-step-${index + 1}`}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${activeStep === index ? 'bg-cyan-400 text-slate-950 ring-2 ring-cyan-200' : 'bg-slate-900'}`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${activeStep === index ? 'bg-slate-950/15 text-slate-950' : 'bg-cyan-400/10 text-cyan-300'}`}>{index + 1}</span>
                        <span className="font-semibold">{labels[command]}</span>
                        {activeStep === index && <span className="ml-auto text-xs font-black uppercase tracking-wide">právě běží</span>}
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
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">3 · Evidence</p>
                <h3 className="mt-2 text-xl font-black">{result.success ? 'Algoritmus funguje.' : 'Robot do cíle nedorazil.'}</h3>
                <p className="mt-2 text-sm text-slate-300">{result.message}</p>
                {!result.success && result.failedStep && (
                  <p className="mt-3 rounded-xl bg-slate-950/40 px-3 py-2 text-sm font-semibold text-amber-100">Diagnostický bod: krok {result.failedStep}</p>
                )}
                {result.success && (
                  <button onClick={nextMission} className="mt-4 rounded-xl bg-white px-4 py-2 font-bold text-slate-950">Další mise →</button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
