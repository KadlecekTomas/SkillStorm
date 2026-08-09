'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  classroomSessionApi,
  type CoopAlgorithmCommand,
  type NetworkedCoopProgram,
  type NetworkedCoopProjection,
} from '@/lib/classroom-session-api';

const POLL_MS = 1_250;

export type NetworkedCoopBridge = {
  active: boolean;
  state: NetworkedCoopProjection | null;
  program: NetworkedCoopProgram | null;
  loading: boolean;
  error: string | null;
  handoff: () => Promise<boolean>;
  rotate: (reason?: string) => Promise<boolean>;
  syncProgram: (commands: CoopAlgorithmCommand[]) => Promise<boolean>;
  refresh: () => Promise<void>;
};

export function useNetworkedCoop(
  sessionId: string | null,
  enabled: boolean,
): NetworkedCoopBridge {
  const [state, setState] = useState<NetworkedCoopProjection | null>(null);
  const [program, setProgram] = useState<NetworkedCoopProgram | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const programRef = useRef<NetworkedCoopProgram | null>(null);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

  const storeProgram = useCallback((next: NetworkedCoopProgram | null): void => {
    programRef.current = next;
    setProgram(next);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId || !enabled) return;
    try {
      const [nextState, nextProgram] = await Promise.all([
        classroomSessionApi.networkedCoop(sessionId),
        classroomSessionApi.networkedCoopProgram(sessionId),
      ]);
      setState(nextState);
      storeProgram(nextProgram);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nepodařilo se synchronizovat dvojici.');
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionId, storeProgram]);

  useEffect(() => {
    if (!sessionId || !enabled) {
      setState(null);
      storeProgram(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => {
      if (!cancelled) void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, refresh, sessionId, storeProgram]);

  const transition = useCallback(
    async (action: 'HANDOFF' | 'ROTATE', reason?: string): Promise<boolean> => {
      if (!sessionId || !enabled) return false;
      try {
        const result = await classroomSessionApi.networkedCoopTransition(
          sessionId,
          action,
          reason,
        );
        setState(result.state);
        const nextProgram = await classroomSessionApi.networkedCoopProgram(sessionId);
        storeProgram(nextProgram);
        setError(null);
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Předání role se nepodařilo.');
        await refresh();
        return false;
      }
    },
    [enabled, refresh, sessionId, storeProgram],
  );

  const syncProgram = useCallback(
    (commands: CoopAlgorithmCommand[]): Promise<boolean> => {
      if (!sessionId || !enabled) return Promise.resolve(false);

      return new Promise<boolean>((resolve) => {
        syncQueueRef.current = syncQueueRef.current.then(async () => {
          try {
            const expectedRevision = programRef.current?.programRevision ?? 0;
            const result = await classroomSessionApi.updateNetworkedCoopProgram(
              sessionId,
              expectedRevision,
              commands,
            );
            storeProgram(result.program);
            setError(null);
            resolve(true);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Sdílený program se nepodařilo uložit.');
            await refresh();
            resolve(false);
          }
        });
      });
    },
    [enabled, refresh, sessionId, storeProgram],
  );

  return {
    active: Boolean(sessionId && enabled),
    state,
    program,
    loading,
    error,
    handoff: () => transition('HANDOFF'),
    rotate: (reason?: string) => transition('ROTATE', reason),
    syncProgram,
    refresh,
  };
}
