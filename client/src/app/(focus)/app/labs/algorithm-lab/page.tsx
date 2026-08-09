'use client';

import { useMemo, useState } from 'react';

type Command = 'FORWARD' | 'LEFT' | 'RIGHT';

type Mission = {
  title: string;
  brief: string;
  target: { x: number; y: number };
  blocks: Command[];
};

const missions: Mission[] = [
  {
    title: 'Doruč balíček',
    brief: 'Sestav přesný algoritmus, který dovede robota ze startu do cíle.',
    target: { x: 3, y: 1 },
    blocks: ['FORWARD', 'FORWARD', 'RIGHT', 'FORWARD'],
  },
  {
    title: 'Obejdi překážku',
    brief: 'Pořadí kroků rozhoduje. Najdi správnou sekvenci bez náhodného zkoušení.',
    target: { x: 2, y: 2 },
    blocks: ['FORWARD', 'RIGHT', 'FORWARD', 'LEFT', 'FORWARD'],
  },
];

const labels: Record<Command, string> = {
  FORWARD: '↑ Krok',
  LEFT: '↶ Vlevo',
  RIGHT: '↷ Vpravo',
};

export default function AlgorithmLabPage() {
  const [missionIndex, setMissionIndex] = useState(0);
  const [program, setProgram] = useState<Command[]>([]);
  const [ran, setRan] = useState(false);
  const mission = missions[missionIndex];

  const success = useMemo(
    () => ran && program.join('|') === mission.blocks.join('|'),
    [mission.blocks, program, ran],
  );

  const add = (command: Command) => {
    setRan(false);
    setProgram((current) => [...current, command]);
  };

  const reset = () => {
    setProgram([]);
    setRan(false);
  };

  const nextMission = () => {
    setMissionIndex((current) => (current + 1) % missions.length);
    reset();
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
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Robot arena</p>
                <h2 className="text-xl font-bold">Start → cíl</h2>
              </div>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">bez časového skóre</span>
            </div>

            <div className="grid aspect-square max-h-[520px] w-full grid-cols-4 grid-rows-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              {Array.from({ length: 16 }, (_, index) => {
                const x = index % 4;
                const y = Math.floor(index / 4);
                const isStart = x === 0 && y === 0;
                const isTarget = x === mission.target.x && y === mission.target.y;
                return (
                  <div key={index} className="flex items-center justify-center border border-slate-800 text-center">
                    {isStart && <span className="text-4xl" aria-label="robot start">🤖</span>}
                    {isTarget && <span className="text-4xl" aria-label="target">📦</span>}
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
                  <button key={command} onClick={() => add(command)} className="rounded-xl bg-slate-800 px-3 py-3 font-bold transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400">
                    {labels[command]}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">2 · Program</p>
                <button onClick={reset} className="text-sm font-semibold text-slate-400 hover:text-white">Vymazat</button>
              </div>
              <div data-testid="algorithm-program" className="mt-4 min-h-28 rounded-2xl bg-slate-950 p-3">
                {program.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">Přidej první příkaz. Nejdřív si ale cestu zkus naplánovat.</p>
                ) : (
                  <ol className="space-y-2">
                    {program.map((command, index) => (
                      <li key={`${command}-${index}`} className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/10 text-xs font-black text-cyan-300">{index + 1}</span>
                        <span className="font-semibold">{labels[command]}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <button onClick={() => setRan(true)} disabled={program.length === 0} className="mt-4 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
                ▶ Spustit program
              </button>
            </div>

            {ran && (
              <div data-testid="algorithm-result" className={`rounded-3xl border p-5 ${success ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">3 · Evidence</p>
                <h3 className="mt-2 text-xl font-black">{success ? 'Algoritmus funguje.' : 'Robot do cíle nedorazil.'}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  {success ? 'Teď umíš doložit konkrétní pořadí kroků, které řeší problém.' : 'Nezkoušej příkazy náhodně. Najdi první krok, kde se tvoje předpověď rozchází s výsledkem, a oprav jen ten.'}
                </p>
                {success && (
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
