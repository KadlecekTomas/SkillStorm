'use client';

import { useMemo, useState, type DragEvent, type JSX } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Box,
  Cable,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cpu,
  Fan,
  HardDrive,
  Keyboard,
  Lightbulb,
  Monitor,
  MousePointer2,
  Power,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  PC_COMPONENTS,
  PC_SLOTS,
  buildProgress,
  componentById,
  isBuildReady,
  isPlacementValid,
  nextRequiredComponent,
  type BuildPcDifficulty,
  type BuildPcScaffolding,
  type PcComponentId,
  type PcSlotId,
} from './build-pc-engine';

type Feedback = {
  tone: 'success' | 'warning' | 'neutral';
  title: string;
  detail: string;
};

type PowerState = 'OFF' | 'BOOTING' | 'SUCCESS';

const COMPONENT_ICON: Record<PcComponentId, JSX.Element> = {
  cpu: <Cpu className="h-5 w-5" aria-hidden="true" />,
  cooler: <Fan className="h-5 w-5" aria-hidden="true" />,
  ram: <CircleDot className="h-5 w-5" aria-hidden="true" />,
  ssd: <HardDrive className="h-5 w-5" aria-hidden="true" />,
  gpu: <Monitor className="h-5 w-5" aria-hidden="true" />,
  psu: <Box className="h-5 w-5" aria-hidden="true" />,
  atx24: <Cable className="h-5 w-5" aria-hidden="true" />,
  eps8: <Zap className="h-5 w-5" aria-hidden="true" />,
};

function feedbackClasses(tone: Feedback['tone']): string {
  if (tone === 'success') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
  if (tone === 'warning') return 'border-amber-300/30 bg-amber-300/10 text-amber-50';
  return 'border-white/10 bg-white/[0.06] text-slate-200';
}

export function BuildPcLab(): JSX.Element {
  const [difficulty, setDifficulty] = useState<BuildPcDifficulty>('EXPLORER');
  const [scaffolding, setScaffolding] = useState<BuildPcScaffolding>('GUIDED');
  const [selected, setSelected] = useState<PcComponentId | null>('cpu');
  const [installed, setInstalled] = useState<Set<PcComponentId>>(() => new Set());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [hintOpen, setHintOpen] = useState(true);
  const [eventCount, setEventCount] = useState(1);
  const [powerState, setPowerState] = useState<PowerState>('OFF');
  const [feedback, setFeedback] = useState<Feedback>({
    tone: 'neutral',
    title: 'Mise spuštěna',
    detail: 'Vyber komponentu a usaď ji do správné části sestavy.',
  });

  const installedCount = installed.size;
  const progress = buildProgress(installedCount);
  const ready = isBuildReady(installed);
  const next = nextRequiredComponent(installed);
  const selectedDefinition = selected ? componentById(selected) : null;

  const statusLabel = useMemo(() => {
    if (powerState === 'SUCCESS') return 'POST OK · sestava žije';
    if (ready) return 'Připraveno k prvnímu startu';
    if (next) return `Checkpoint ${installedCount + 1}/${PC_COMPONENTS.length} · ${next.shortName}`;
    return 'Sestava připravena';
  }, [installedCount, next, powerState, ready]);

  function selectComponent(componentId: PcComponentId): void {
    if (installed.has(componentId)) return;
    setSelected(componentId);
    setEventCount((value) => value + 1);
    setFeedback({
      tone: 'neutral',
      title: componentById(componentId).name,
      detail: componentById(componentId).purpose,
    });
  }

  function placeComponent(slotId: PcSlotId, componentId = selected): void {
    if (!componentId) {
      setFeedback({
        tone: 'warning',
        title: 'Nejdřív vyber komponentu',
        detail: 'Můžeš použít drag & drop, nebo komponentu vybrat a potom klepnout na cílové místo.',
      });
      return;
    }

    const component = componentById(componentId);
    if (installed.has(componentId)) return;

    if (!isPlacementValid(componentId, slotId)) {
      setWrongAttempts((value) => value + 1);
      setEventCount((value) => value + 1);
      setFeedback({
        tone: 'warning',
        title: 'Tady to nebude fungovat',
        detail:
          difficulty === 'EXPLORER'
            ? `${component.shortName} patří jinam. Zkus využít tvar, popisek a zvýrazněný checkpoint.`
            : `Systém tuhle vazbu odmítl. Zvaž rozhraní a funkci komponenty.`,
      });
      return;
    }

    const nextInstalled = new Set(installed);
    nextInstalled.add(componentId);
    setInstalled(nextInstalled);
    setEventCount((value) => value + 2);
    setSelected(null);
    setHintOpen(false);
    setFeedback({
      tone: 'success',
      title: `${component.shortName} zapojeno`,
      detail: component.checkpoint,
    });

    const following = nextRequiredComponent(nextInstalled);
    if (following && scaffolding !== 'INDEPENDENT') {
      setSelected(following.id);
    }
  }

  function onDragStart(event: DragEvent<HTMLButtonElement>, componentId: PcComponentId): void {
    event.dataTransfer.setData('text/skillstorm-component', componentId);
    event.dataTransfer.effectAllowed = 'move';
    selectComponent(componentId);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>, slotId: PcSlotId): void {
    event.preventDefault();
    const dragged = event.dataTransfer.getData('text/skillstorm-component') as PcComponentId;
    placeComponent(slotId, dragged || selected);
  }

  function resetBuild(): void {
    setInstalled(new Set());
    setSelected('cpu');
    setWrongAttempts(0);
    setHintOpen(true);
    setPowerState('OFF');
    setEventCount((value) => value + 1);
    setFeedback({
      tone: 'neutral',
      title: 'Sestava resetována',
      detail: 'Nový pokus začíná od čisté skříně.',
    });
  }

  function powerOn(): void {
    setEventCount((value) => value + 1);
    if (!ready) {
      setFeedback({
        tone: 'warning',
        title: 'POST se nespustí',
        detail: `Chybí ${PC_COMPONENTS.length - installedCount} ${PC_COMPONENTS.length - installedCount === 1 ? 'kritická komponenta' : 'kritické komponenty'}. Dokonči sestavu.`,
      });
      return;
    }

    setPowerState('BOOTING');
    setFeedback({ tone: 'neutral', title: 'Power on…', detail: 'Deska kontroluje klíčové komponenty.' });
    window.setTimeout(() => {
      setPowerState('SUCCESS');
      setEventCount((value) => value + 2);
      setFeedback({
        tone: 'success',
        title: 'POST úspěšný',
        detail: 'Sestava prošla první kontrolou. Teď už nejde o skládání — další mise bude diagnostika.',
      });
    }, 900);
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#07101f] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-80" aria-hidden="true">
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <header className="relative z-20 border-b border-white/10 bg-[#07101f]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-violet-400/30 bg-violet-500/15 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
              <Cpu className="h-5 w-5 text-violet-200" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200/80">
                <span>Interactive IT Lab</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-slate-400">D3 preview</span>
              </div>
              <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">Build a PC · První boot</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 sm:inline-flex">7.B · Informatika</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 font-semibold text-emerald-200">DEVICES</span>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1700px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)_330px] lg:px-8 lg:py-6">
        <aside className="order-2 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur-xl lg:order-1 lg:max-h-[calc(100dvh-110px)] lg:overflow-y-auto">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Komponenty</p>
              <h2 className="mt-1 text-base font-bold">Stůl technika</h2>
            </div>
            <button
              type="button"
              onClick={resetBuild}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Resetovat sestavu"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {PC_COMPONENTS.map((component) => {
              const done = installed.has(component.id);
              const active = selected === component.id;
              return (
                <motion.button
                  key={component.id}
                  type="button"
                  draggable={!done}
                  onDragStartCapture={(event) => onDragStart(event, component.id)}
                  onClick={() => selectComponent(component.id)}
                  disabled={done}
                  data-testid={`component-${component.id}`}
                  whileTap={done ? { scale: 1 } : { scale: 0.98 }}
                  className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                    done
                      ? 'border-emerald-400/20 bg-emerald-400/[0.07] opacity-70'
                      : active
                        ? 'border-violet-300/50 bg-violet-400/15 shadow-[0_0_30px_rgba(139,92,246,0.14)]'
                        : 'border-white/10 bg-black/15 hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${component.accent} text-slate-950 shadow-lg`}>
                      {done ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : COMPONENT_ICON[component.id]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black tracking-[0.16em] text-slate-500">{component.shortName}</div>
                      <div className="mt-0.5 text-xs font-bold text-slate-100 sm:text-sm">{component.name}</div>
                      <div className="mt-1 hidden text-xs leading-5 text-slate-500 lg:block">{component.purpose}</div>
                    </div>
                  </div>
                  {!done && <div className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white/25 group-hover:bg-violet-300" />}
                </motion.button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
              <MousePointer2 className="h-3.5 w-3.5" aria-hidden="true" /> Drag
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" /> Tap + tap
            </div>
          </div>
        </aside>

        <section className="order-1 min-w-0 lg:order-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/60">Aktuální checkpoint</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-100" data-testid="checkpoint-label">{statusLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDifficulty((value) => (value === 'EXPLORER' ? 'BUILDER' : 'EXPLORER'))}
                className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:bg-white/10"
              >
                {difficulty === 'EXPLORER' ? 'Explorer' : 'Builder'}
              </button>
              <button
                type="button"
                onClick={() => setScaffolding((value) => (value === 'GUIDED' ? 'INDEPENDENT' : 'GUIDED'))}
                className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:bg-white/10"
              >
                {scaffolding === 'GUIDED' ? 'Guided' : 'Independent'}
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0a1528] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/10 to-transparent" aria-hidden="true" />
            <div className="relative aspect-[4/3] min-h-[430px] w-full sm:aspect-[16/10] lg:min-h-[610px]">
              <div className="absolute inset-4 rounded-[28px] border border-slate-600/30 bg-gradient-to-br from-slate-800 via-slate-900 to-black p-[5%] shadow-inner sm:inset-6">
                <div className="absolute left-[7%] top-[7%] text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">SkillStorm Lab Chassis</div>
                <div className="absolute inset-[9%_7%_14%_9%] [perspective:1200px]">
                  <motion.div
                    initial={{ opacity: 0, rotateX: 8, rotateZ: -1.5, scale: 0.96 }}
                    animate={{ opacity: 1, rotateX: 5, rotateZ: -0.8, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="relative h-full w-full overflow-hidden rounded-[24px] border border-emerald-300/15 bg-[#10271f] shadow-[0_25px_70px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.03)] [transform-style:preserve-3d]"
                  >
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,.12) 1px, transparent 1px),linear-gradient(90deg,rgba(16,185,129,.12) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
                    <div className="absolute left-[8%] top-[11%] h-[4%] w-[70%] rounded-full bg-emerald-300/10" />
                    <div className="absolute bottom-[12%] left-[8%] h-[1px] w-[70%] bg-emerald-200/10" />
                    <div className="absolute right-[8%] top-[12%] flex flex-col gap-2 opacity-40" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, index) => <span key={index} className="h-2 w-5 rounded-sm bg-slate-300/30" />)}
                    </div>

                    {PC_SLOTS.map((slot) => {
                      const component = PC_COMPONENTS.find((item) => item.target === slot.id);
                      const done = component ? installed.has(component.id) : false;
                      const selectedTargetsHere = selectedDefinition?.target === slot.id;
                      const emphasize = !done && selectedTargetsHere && scaffolding === 'GUIDED';

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          data-testid={`slot-${slot.id}`}
                          onClick={() => placeComponent(slot.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => onDrop(event, slot.id)}
                          className={`absolute rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-violet-300 ${
                            done
                              ? 'border-emerald-300/40 bg-emerald-300/15 shadow-[0_0_25px_rgba(52,211,153,0.12)]'
                              : emphasize
                                ? 'animate-pulse border-violet-300/70 bg-violet-400/15 shadow-[0_0_35px_rgba(167,139,250,0.25)]'
                                : 'border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/[0.06]'
                          }`}
                          style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}
                          aria-label={`${slot.label}: ${slot.hint}`}
                        >
                          <AnimatePresence mode="wait">
                            {done && component ? (
                              <motion.div
                                key="installed"
                                initial={{ scale: 0.75, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`flex h-full w-full items-center justify-center rounded-[inherit] bg-gradient-to-br ${component.accent} p-1 text-center text-[8px] font-black text-slate-950 shadow-xl sm:text-[10px]`}
                              >
                                {component.shortName}
                              </motion.div>
                            ) : (
                              <motion.div key="empty" className="flex h-full w-full items-center justify-center p-1 text-center text-[7px] font-bold tracking-wide text-slate-500 sm:text-[9px]">
                                {(difficulty === 'EXPLORER' || emphasize) && slot.label}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      );
                    })}

                    <div className="pointer-events-none absolute bottom-[4%] right-[4%] rounded-lg border border-emerald-300/10 bg-black/20 px-2 py-1 text-[7px] font-bold tracking-[0.16em] text-emerald-300/30 sm:text-[9px]">SS-MB 01</div>
                  </motion.div>
                </div>

                <motion.button
                  type="button"
                  data-testid="power-button"
                  onClick={powerOn}
                  whileTap={{ scale: 0.96 }}
                  className={`absolute bottom-[4%] right-[6%] flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition sm:px-5 ${
                    powerState === 'SUCCESS'
                      ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-100 shadow-[0_0_35px_rgba(52,211,153,.2)]'
                      : ready
                        ? 'border-violet-300/40 bg-violet-500/20 text-violet-100 shadow-[0_0_35px_rgba(139,92,246,.2)] hover:bg-violet-500/30'
                        : 'border-white/10 bg-black/25 text-slate-500'
                  }`}
                >
                  <Power className={`h-4 w-4 ${powerState === 'BOOTING' ? 'animate-pulse' : ''}`} aria-hidden="true" />
                  {powerState === 'SUCCESS' ? 'POST OK' : powerState === 'BOOTING' ? 'Booting…' : 'Power on'}
                </motion.button>
              </div>

              {powerState === 'SUCCESS' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(52,211,153,.16),transparent_45%)]"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          <div className={`mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3 ${feedbackClasses(feedback.tone)}`} data-testid="build-feedback">
            {feedback.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : feedback.tone === 'warning' ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <Sparkles className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
            <div>
              <p className="text-sm font-bold">{feedback.title}</p>
              <p className="mt-0.5 text-xs leading-5 opacity-75">{feedback.detail}</p>
            </div>
          </div>
        </section>

        <aside className="order-3 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl lg:max-h-[calc(100dvh-110px)] lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Mission brief</p>
              <h2 className="mt-1 text-xl font-black tracking-tight">Rozběhni pracovní stanici</h2>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-400">Technik nechal novou stanici rozebranou. Tvůj úkol není zapamatovat názvy — musíš pochopit, kam komponenty patří a proč.</p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>POST readiness</span>
              <span data-testid="build-progress-label" className="text-cyan-200">{progress} %</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div data-testid="build-progress" className="h-full rounded-full bg-gradient-to-r from-violet-400 via-cyan-300 to-emerald-300" animate={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-slate-500">
              <span>{installedCount}/{PC_COMPONENTS.length} komponent</span>
              <span>{wrongAttempts} chybných vazeb</span>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Checkpointy</h3>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Build path</span>
            </div>
            <div className="mt-3 space-y-2">
              {PC_COMPONENTS.map((component, index) => {
                const done = installed.has(component.id);
                const active = next?.id === component.id;
                return (
                  <div key={component.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${done ? 'border-emerald-400/15 bg-emerald-400/[0.06]' : active ? 'border-violet-400/20 bg-violet-400/[0.07]' : 'border-transparent bg-white/[0.02]'}`}>
                    <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-black ${done ? 'bg-emerald-400/20 text-emerald-200' : active ? 'bg-violet-400/20 text-violet-200' : 'bg-white/[0.05] text-slate-600'}`}>
                      {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-xs font-bold ${done ? 'text-emerald-100' : active ? 'text-white' : 'text-slate-500'}`}>{component.checkpoint}</div>
                    </div>
                    {active && <ChevronRight className="h-4 w-4 text-violet-300" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setHintOpen((value) => !value);
              setEventCount((value) => value + 1);
            }}
            className="mt-5 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.07]"
          >
            <span className="flex items-center gap-2 text-sm font-bold"><Lightbulb className="h-4 w-4 text-amber-300" aria-hidden="true" /> Diagnostická nápověda</span>
            <ChevronRight className={`h-4 w-4 text-slate-500 transition ${hintOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
          </button>
          <AnimatePresence>
            {hintOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-2 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-100/70">
                  {next ? (scaffolding === 'INDEPENDENT' ? 'Sleduj rozhraní, tvar a funkci. SkillStorm ti cíl neprozradí.' : `Teď řešíš ${next.shortName}. ${next.purpose}`) : 'Sestava je fyzicky kompletní. Poslední důkaz je úspěšný POST.'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-center">
            <div className="rounded-xl bg-black/20 px-2 py-3">
              <div className="text-lg font-black text-white">{eventCount}</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">semantic events</div>
            </div>
            <div className="rounded-xl bg-black/20 px-2 py-3">
              <div className="text-lg font-black text-white">0</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">pointer streams</div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
