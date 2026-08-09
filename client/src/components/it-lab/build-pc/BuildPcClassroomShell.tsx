'use client';

import { useRef, type DragEvent, type JSX, type MouseEvent } from 'react';
import { Cloud, CloudOff, PauseCircle, Radio, ShieldCheck } from 'lucide-react';
import { BuildPcLab } from './BuildPcLab';
import {
  PC_COMPONENTS,
  isPlacementValid,
  type PcComponentId,
  type PcSlotId,
} from './build-pc-engine';
import { useBuildPcClassroom } from './use-build-pc-classroom';

function componentFromTestId(testId: string | null): PcComponentId | null {
  if (!testId?.startsWith('component-')) return null;
  const value = testId.slice('component-'.length) as PcComponentId;
  return PC_COMPONENTS.some((component) => component.id === value) ? value : null;
}

function slotFromTestId(testId: string | null): PcSlotId | null {
  if (!testId?.startsWith('slot-')) return null;
  return testId.slice('slot-'.length) as PcSlotId;
}

export function BuildPcClassroomShell(): JSX.Element {
  const classroom = useBuildPcClassroom();
  const selectedRef = useRef<PcComponentId | null>('cpu');
  const installedRef = useRef<Set<PcComponentId>>(new Set());

  function rememberPlacement(componentId: PcComponentId, slotId: PcSlotId): void {
    if (!classroom.isClassroomMode || !classroom.canInteract) return;
    if (!isPlacementValid(componentId, slotId) || installedRef.current.has(componentId)) return;

    installedRef.current.add(componentId);
    void classroom.emit('COMPONENT_PLACED', {
      componentId,
      slotId,
      installedCount: installedRef.current.size,
      totalComponents: PC_COMPONENTS.length,
    });
    void classroom.emit('CHECKPOINT_COMPLETED', {
      checkpoint: componentId,
      installedCount: installedRef.current.size,
      completionIsMastery: false,
    });
    selectedRef.current = null;
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>): void {
    if (!classroom.isClassroomMode || !classroom.canInteract) return;
    const target = event.target as HTMLElement;
    const interactive = target.closest<HTMLElement>('[data-testid]');
    const testId = interactive?.dataset.testid ?? null;

    const component = componentFromTestId(testId);
    if (component) {
      selectedRef.current = component;
      return;
    }

    const slot = slotFromTestId(testId);
    if (slot && selectedRef.current) {
      rememberPlacement(selectedRef.current, slot);
      return;
    }

    if (testId === 'power-button' && installedRef.current.size === PC_COMPONENTS.length) {
      window.setTimeout(() => {
        void classroom.emit('CHECKPOINT_COMPLETED', {
          checkpoint: 'POST_OK',
          installedCount: installedRef.current.size,
          completionIsMastery: false,
        });
      }, 950);
    }
  }

  function handleDropCapture(event: DragEvent<HTMLDivElement>): void {
    if (!classroom.isClassroomMode || !classroom.canInteract) return;
    const target = event.target as HTMLElement;
    const slotElement = target.closest<HTMLElement>('[data-testid^="slot-"]');
    const slot = slotFromTestId(slotElement?.dataset.testid ?? null);
    const component = event.dataTransfer.getData('text/skillstorm-component') as PcComponentId;
    if (slot && component) rememberPlacement(component, slot);
  }

  const blocked = classroom.isClassroomMode && !classroom.canInteract;

  return (
    <div className="relative min-h-[100dvh] bg-[#07101f]" data-testid="build-pc-classroom-shell">
      {classroom.isClassroomMode && (
        <div className="fixed left-1/2 top-3 z-[80] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-[#07101f]/90 px-3 py-2 text-xs font-semibold text-slate-200 shadow-2xl backdrop-blur-xl">
          {classroom.error ? (
            <CloudOff className="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
          ) : classroom.projection?.status === 'RUNNING' ? (
            <Radio className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          ) : (
            <Cloud className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
          )}
          <span className="truncate" data-testid="classroom-session-label">{classroom.sessionLabel}</span>
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <span className="hidden items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {classroom.confirmedEvents} server events
          </span>
        </div>
      )}

      <div onClickCapture={handleClickCapture} onDropCapture={handleDropCapture}>
        <BuildPcLab />
      </div>

      {blocked && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[#07101f]/72 px-4 backdrop-blur-sm" data-testid="classroom-blocking-overlay">
          <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-[#0b1729] p-6 text-center text-white shadow-[0_30px_100px_rgba(0,0,0,.55)]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
              <PauseCircle className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/60">Classroom control</p>
            <h2 className="mt-2 text-xl font-black">{classroom.sessionLabel}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Stav hodiny řídí učitel. Tvoje rozestavěná sestava zůstává na místě a pokračuješ přesně odsud, jakmile se session znovu rozběhne.
            </p>
            {classroom.error && <p className="mt-4 text-xs text-rose-200">{classroom.error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
