'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock3, PlayCircle, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorAlert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useClassroomStructure, type StructureClassItem } from '@/hooks/use-classroom-structure';
import { classroomSessionApi, type ClassroomDeliveryMode } from '@/lib/classroom-session-api';
import { formatClassName } from '@/lib/class-label';
import { teacherMissionControlPath } from '@/lib/interactive-lesson-routes';
import { lessonExperienceApi, type LessonExperience } from '@/lib/lesson-experience-api';

function uniqueClasses(classes: StructureClassItem[]): StructureClassItem[] {
  const seen = new Set<string>();
  return classes.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function LessonExperienceLaunchPage(): React.JSX.Element {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const structure = useClassroomStructure({ enabled: isAuthenticated });
  const [lesson, setLesson] = useState<LessonExperience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classSectionId, setClassSectionId] = useState('');
  const [mode, setMode] = useState<ClassroomDeliveryMode | ''>('');
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    lessonExperienceApi
      .get(params.lessonId)
      .then((result) => {
        if (!active) return;
        setLesson(result);
        const published = result.versions.find((item) => item.status === 'PUBLISHED');
        if (published) setMode(published.recommendedMode);
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Interaktivní hodinu se nepodařilo načíst.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.lessonId]);

  const version = lesson?.versions.find((item) => item.status === 'PUBLISHED') ?? null;
  const classes = useMemo(() => {
    if (!structure.data) return [];
    return uniqueClasses([
      ...(structure.data.homeroom ? [structure.data.homeroom] : []),
      ...structure.data.teachingClasses,
      ...structure.data.otherClasses,
    ]);
  }, [structure.data]);

  async function launch(): Promise<void> {
    if (!version || !classSectionId || !mode || launching) return;
    const target = teacherMissionControlPath('pending', version.stages);
    if (!target) {
      setError('Tato hodina zatím nemá připojený interaktivní player.');
      return;
    }

    setLaunching(true);
    setError(null);
    try {
      const session = await classroomSessionApi.createSession({
        lessonExperienceVersionId: version.id,
        classSectionId,
        mode,
      });
      const path = teacherMissionControlPath(session.id, version.stages);
      if (!path) throw new Error('Pro tuto hodinu chybí Mission Control.');
      router.push(path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Hodinu se nepodařilo připravit.');
      setLaunching(false);
    }
  }

  if (loading) {
    return <LoadingSpinner label="Načítám interaktivní hodinu" />;
  }
  if (!lesson || !version) {
    return <ErrorAlert title="Hodina není dostupná" description={error ?? 'Publikovaná verze nebyla nalezena.'} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10" data-testid="lesson-experience-launch-page">
      <Link
        href="/app/library"
        className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět do knihovny
      </Link>

      <Card className="overflow-hidden rounded-3xl border-accent/20 bg-gradient-to-br from-white via-white to-accent-soft/40 p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Interaktivní výuka</Badge>
          <Badge variant="neutral">{lesson.scope === 'GLOBAL' ? 'SkillStorm obsah' : 'Školní obsah'}</Badge>
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">{version.title}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-ink-muted">
          {version.summary ?? lesson.description ?? version.learningObjective}
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold text-ink-dim">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            {version.estimatedDurationMin} minut
          </span>
          <span>{version.stages.length} částí hodiny</span>
          <span>Cíl: {version.learningObjective}</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="rounded-3xl p-6 shadow-soft">
          <h2 className="text-xl font-black text-ink">Průběh hodiny</h2>
          <div className="mt-5 space-y-3">
            {version.stages.map((stage, index) => (
              <div key={stage.id} className="flex gap-4 rounded-2xl border border-slate-100 p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft font-black text-accent-deep">
                  {index + 1}
                </div>
                <div>
                  <p className="font-extrabold text-ink">{stage.title}</p>
                  <p className="mt-1 text-sm text-ink-muted">{stage.durationMin} min · {stage.stageType}</p>
                  {stage.teacherGuidance && (
                    <p className="mt-2 text-sm leading-6 text-ink-muted">{stage.teacherGuidance}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="h-fit rounded-3xl border-accent/20 p-6 shadow-soft lg:sticky lg:top-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent-deep">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.08em] text-ink-dim">Spustit se třídou</p>
              <h2 className="text-xl font-black text-ink">Připravit živou hodinu</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-extrabold text-ink">Třída</label>
              <Select value={classSectionId} onValueChange={setClassSectionId}>
                <SelectTrigger data-testid="lesson-class-select">
                  <SelectValue placeholder={structure.loading ? 'Načítám třídy…' : 'Vyber třídu'} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {formatClassName(item)} · {item.studentCount} žáků
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {structure.error && (
                <p className="mt-2 text-xs text-danger">Třídy se nepodařilo načíst.</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-extrabold text-ink">Režim zařízení</label>
              <Select value={mode} onValueChange={(value) => setMode(value as ClassroomDeliveryMode)}>
                <SelectTrigger data-testid="lesson-mode-select">
                  <SelectValue placeholder="Vyber režim" />
                </SelectTrigger>
                <SelectContent>
                  {version.supportedModes.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <ErrorAlert title="Hodinu nelze spustit" description={error} />}

            <Button
              className="w-full justify-center rounded-xl py-6 text-base font-black"
              disabled={!classSectionId || !mode || launching || !teacherMissionControlPath('pending', version.stages)}
              onClick={() => void launch()}
              data-testid="lesson-launch-submit"
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              {launching ? 'Připravuji hodinu…' : 'Připravit pro třídu'}
            </Button>
            <p className="text-xs leading-5 text-ink-dim">
              Vznikne class-bound session. Žáci ji uvidí na svém Přehledu až po spuštění v Mission Control.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
