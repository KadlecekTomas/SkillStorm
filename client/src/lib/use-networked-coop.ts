'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  classroomSessionApi,
  type NetworkedCoopProjection,
} from '@/lib/classroom-session-api';

const POLL_MS = 1_250;

export type NetworkedCoopBridge = {
  active: boolean;
  state: NetworkedCoopProjection | null;
  loading: boolean;
  error: string | null;
  handoff: () => Promise<boolean>;
  rotate: (reason?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

export function useNetworkedCoop(
  sessionId: string | null,
  enabled: boolean,
): NetworkedCoopBridge {
  const [state, setState] = useState<NetworkedCoopProjection | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId || !enabled) return;
    try {
      const next = await classroomSessionApi.networkedCoop(sessionId);
      setState(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nepodařilo se synchronizovat dvojici.');
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionId]);

  useEffect(() => {
    if (!sessionId || !enabled) {
      setState(null);
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
  }, [enabled, refresh, sessionId]);

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
        setError(null);
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Předání role se nepodařilo.');
        await refresh();
        return false;
      }
    },
    [enabled, refresh, sessionId],
  );

  return {
    active: Boolean(sessionId && enabled),
    state,
    loading,
    error,
    handoff: () => transition('HANDOFF'),
    rotate: (reason?: string) => transition('ROTATE', reason),
    refresh,
  };
}
