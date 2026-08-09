'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HttpError } from '@/lib/http/client';
import {
  classroomSessionApi,
  type LiveSemanticEventType,
  type StudentClassroomSessionProjection,
} from '@/lib/classroom-session-api';

const POLL_MS = 1_750;

function errorCode(error: unknown): string | null {
  if (!(error instanceof HttpError) || !error.data || typeof error.data !== 'object') {
    return null;
  }
  const data = error.data as { code?: unknown };
  return typeof data.code === 'string' ? data.code : null;
}

function eventId(type: LiveSemanticEventType): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `pc-${type.toLowerCase().slice(0, 18)}-${suffix}`;
}

export type BuildPcClassroomBridge = {
  sessionId: string | null;
  isClassroomMode: boolean;
  projection: StudentClassroomSessionProjection | null;
  loading: boolean;
  error: string | null;
  confirmedEvents: number;
  canInteract: boolean;
  sessionLabel: string;
  emit: (
    type: LiveSemanticEventType,
    payload?: Record<string, unknown>,
  ) => Promise<boolean>;
  refresh: () => Promise<void>;
};

export function useBuildPcClassroom(): BuildPcClassroomBridge {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [projection, setProjection] = useState<StudentClassroomSessionProjection | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const [confirmedEvents, setConfirmedEvents] = useState(0);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      const next = await classroomSessionApi.studentProjection(sessionId);
      setProjection(next);
      setError(null);
    } catch (caught) {
      if (errorCode(caught) === 'SESSION_FINISHED') {
        setProjection((current) =>
          current ? { ...current, status: 'FINISHED', finishedAt: new Date().toISOString() } : current,
        );
        setError(null);
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Nepodařilo se načíst stav hodiny.');
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setProjection(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const connect = async (): Promise<void> => {
      setLoading(true);
      try {
        await classroomSessionApi.joinStudent(sessionId);
        if (cancelled) return;
        const next = await classroomSessionApi.studentProjection(sessionId);
        if (cancelled) return;
        setProjection(next);
        setError(null);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Nepodařilo se připojit k hodině.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void connect();
    const timer = window.setInterval(() => {
      if (!cancelled) void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh, sessionId]);

  const emit = useCallback(
    async (
      type: LiveSemanticEventType,
      payload?: Record<string, unknown>,
    ): Promise<boolean> => {
      if (!sessionId || !projection?.currentStage || projection.status !== 'RUNNING') {
        return false;
      }

      const body = {
        eventId: eventId(type),
        stageId: projection.currentStage.id,
        eventType: type,
        ...(payload ? { payload } : {}),
        occurredAt: new Date().toISOString(),
      };

      const send = () => classroomSessionApi.sendSemanticEvent(sessionId, body);
      try {
        const result = await send();
        if (!result.replayed) setConfirmedEvents((count) => count + 1);
        setError(null);
        return true;
      } catch (firstError) {
        // Reuse the exact eventId once. If the first request reached the server but
        // the response was lost, D2-C's idempotency contract converts this into replay.
        if (firstError instanceof HttpError && firstError.status >= 500) {
          try {
            const retried = await send();
            if (!retried.replayed) setConfirmedEvents((count) => count + 1);
            setError(null);
            return true;
          } catch (retryError) {
            setError(retryError instanceof Error ? retryError.message : 'Event se nepodařilo uložit.');
            return false;
          }
        }

        if (
          errorCode(firstError) === 'EVENT_STAGE_NOT_CURRENT' ||
          errorCode(firstError) === 'SESSION_NOT_ACCEPTING_EVENTS'
        ) {
          await refresh();
        }
        setError(firstError instanceof Error ? firstError.message : 'Event se nepodařilo uložit.');
        return false;
      }
    },
    [projection, refresh, sessionId],
  );

  const canInteract = !sessionId || projection?.status === 'RUNNING';
  const sessionLabel = useMemo(() => {
    if (!sessionId) return 'Solo trénink';
    if (loading) return 'Připojuji hodinu…';
    if (projection?.status === 'DRAFT') return 'Čeká se na spuštění učitelem';
    if (projection?.status === 'PAUSED') return 'Hodina je pozastavena';
    if (projection?.status === 'FINISHED') return 'Hodina byla ukončena';
    if (projection?.status === 'RUNNING') {
      return projection.currentStage?.title
        ? `Live · ${projection.currentStage.title}`
        : 'Live hodina';
    }
    return error ? 'Spojení s hodinou selhalo' : 'Classroom session';
  }, [error, loading, projection, sessionId]);

  return {
    sessionId,
    isClassroomMode: Boolean(sessionId),
    projection,
    loading,
    error,
    confirmedEvents,
    canInteract,
    sessionLabel,
    emit,
    refresh,
  };
}
