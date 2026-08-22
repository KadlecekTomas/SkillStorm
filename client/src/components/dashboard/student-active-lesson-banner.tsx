'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, PauseCircle, Radio, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  classroomSessionApi,
  type ActiveClassroomSessionSummary,
} from '@/lib/classroom-session-api';
import { formatClassName } from '@/lib/class-label';
import { studentInteractiveLessonPath } from '@/lib/interactive-lesson-routes';

const POLL_MS = 8_000;

export function StudentActiveLessonBanner(): React.JSX.Element | null {
  const [session, setSession] = useState<ActiveClassroomSessionSummary | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const load = async (): Promise<void> => {
      try {
        const result = await classroomSessionApi.myActiveSession();
        if (active) setSession(result);
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) timer = window.setTimeout(() => void load(), POLL_MS);
      }
    };

    void load();
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  const href = useMemo(
    () =>
      session
        ? studentInteractiveLessonPath(session.id, session.currentStage)
        : null,
    [session],
  );

  if (!session || !href) return null;

  const isPaused = session.status === 'PAUSED';
  const classLabel = session.classSection
    ? formatClassName(session.classSection)
    : null;

  return (
    <Link href={href} className="group block" data-testid="student-active-lesson-link">
      <Card
        className="overflow-hidden rounded-3xl border-2 border-cyan-300/50 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-0 text-white shadow-xl transition-transform group-hover:-translate-y-0.5"
        data-testid="student-active-lesson-banner"
      >
        <div className="relative p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isPaused ? 'warning' : 'info'}>
                  {isPaused ? (
                    <span className="inline-flex items-center gap-1.5">
                      <PauseCircle className="h-3.5 w-3.5" /> Pozastaveno učitelem
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 animate-pulse" /> Právě probíhá
                    </span>
                  )}
                </Badge>
                {classLabel && <Badge variant="neutral">{classLabel}</Badge>}
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.15em] text-cyan-200/70">
                Živá interaktivní hodina
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {session.lesson.title}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-300">
                {session.currentStage?.title ?? 'Učitel právě vede třídu interaktivní hodinou.'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-cyan-300 px-5 py-3.5 font-black text-slate-950 shadow-lg transition group-hover:bg-cyan-200">
              <Sparkles className="h-5 w-5" />
              {isPaused ? 'Otevřít hodinu' : 'Připojit se'}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
