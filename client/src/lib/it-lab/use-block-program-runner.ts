'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { initialAlgorithmState, type AlgorithmState, type AlgorithmWorld } from './algorithm-engine';
import {
  executeBlockProgram,
  type BlockExecutionStep,
  type BlockProgramNode,
  type BlockProgramResult,
} from './block-program-engine';

export type BlockProgramRunnerStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE';
export type BlockProgramRunnerSpeed = 'SLOW' | 'NORMAL' | 'FAST';

const STEP_DELAY_MS: Record<BlockProgramRunnerSpeed, number> = {
  SLOW: 1100,
  NORMAL: 650,
  FAST: 280,
};

export function useBlockProgramRunner(program: BlockProgramNode[], world: AlgorithmWorld) {
  const [execution, setExecution] = useState<BlockProgramResult | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [status, setStatus] = useState<BlockProgramRunnerStatus>('IDLE');
  const [speed, setSpeed] = useState<BlockProgramRunnerSpeed>('NORMAL');
  const [runCount, setRunCount] = useState(0);

  const visibleSteps = useMemo(
    () => execution?.steps.slice(0, visibleCount) ?? [],
    [execution, visibleCount],
  );
  const activeStep: BlockExecutionStep | null = visibleSteps.at(-1) ?? null;
  const state: AlgorithmState = activeStep?.state ?? initialAlgorithmState();
  const result = status === 'COMPLETE' ? execution : null;
  const totalSteps = execution?.steps.length ?? 0;

  useEffect(() => {
    if (status !== 'RUNNING' || !execution) return;

    if (visibleCount >= execution.steps.length) {
      setStatus('COMPLETE');
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(current + 1, execution.steps.length));
    }, STEP_DELAY_MS[speed]);

    return () => window.clearTimeout(timer);
  }, [execution, speed, status, visibleCount]);

  const run = useCallback(() => {
    const nextExecution = executeBlockProgram(program, world);
    setExecution(nextExecution);
    setVisibleCount(0);
    setRunCount((current) => current + 1);
    setStatus(nextExecution.steps.length === 0 ? 'COMPLETE' : 'RUNNING');
  }, [program, world]);

  const togglePause = useCallback(() => {
    setStatus((current) => {
      if (current === 'RUNNING') return 'PAUSED';
      if (current === 'PAUSED') return 'RUNNING';
      return current;
    });
  }, []);

  const step = useCallback(() => {
    if (status === 'RUNNING') return;

    if (!execution || status === 'IDLE' || status === 'COMPLETE') {
      const nextExecution = executeBlockProgram(program, world);
      setExecution(nextExecution);
      setRunCount((current) => current + 1);
      if (nextExecution.steps.length === 0) {
        setVisibleCount(0);
        setStatus('COMPLETE');
        return;
      }
      setVisibleCount(1);
      setStatus(nextExecution.steps.length === 1 ? 'COMPLETE' : 'PAUSED');
      return;
    }

    const nextCount = Math.min(visibleCount + 1, execution.steps.length);
    setVisibleCount(nextCount);
    setStatus(nextCount >= execution.steps.length ? 'COMPLETE' : 'PAUSED');
  }, [execution, program, status, visibleCount, world]);

  const resetPlayback = useCallback(() => {
    setExecution(null);
    setVisibleCount(0);
    setStatus('IDLE');
  }, []);

  const resetAll = useCallback(() => {
    setExecution(null);
    setVisibleCount(0);
    setStatus('IDLE');
    setRunCount(0);
    setSpeed('NORMAL');
  }, []);

  return {
    activeStep,
    execution,
    isPaused: status === 'PAUSED',
    isRunning: status === 'RUNNING',
    result,
    run,
    runCount,
    resetAll,
    resetPlayback,
    setSpeed,
    speed,
    state,
    status,
    step,
    togglePause,
    totalSteps,
    visibleCount,
    visibleSteps,
  };
}
