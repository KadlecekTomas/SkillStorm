'use client';

import Link from 'next/link';
import { Clock3, PlayCircle, Sparkles } from 'lucide-react';
import type { LessonExperience } from '@/lib/lesson-experience-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Props = {
  items: LessonExperience[];
};

export function LessonExperienceLibraryList({ items }: Props): React.JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4" data-testid="interactive-lessons-section">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold text-accent-deep">
            <Sparkles className="h-4 w-4" />
            Interaktivní hodiny
          </div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
            Spusť výuku, ne jen soubor
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
            Připravené Lesson Experiences propojí třídu, živou aktivitu, Mission Control a learning evidence.
          </p>
        </div>
        <Badge variant="success">{items.length} připravených</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((lesson) => {
          const version = lesson.versions.find((item) => item.status === 'PUBLISHED') ?? lesson.versions[0];
          if (!version) return null;
          return (
            <Card
              key={lesson.id}
              className="flex h-full flex-col justify-between gap-5 rounded-3xl border-accent/20 bg-gradient-to-br from-white via-white to-accent-soft/40 p-5 shadow-soft"
              data-testid={`interactive-lesson-${lesson.slug}`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="info">Interaktivní výuka</Badge>
                  <Badge variant="neutral">
                    {lesson.scope === 'GLOBAL' ? 'SkillStorm' : 'Školní'}
                  </Badge>
                </div>
                <h3 className="mt-4 text-xl font-black text-ink">{version.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-muted">
                  {version.summary ?? lesson.description ?? version.learningObjective}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-ink-dim">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {version.estimatedDurationMin} min
                  </span>
                  <span>{version.stages.length} částí hodiny</span>
                  <span>{version.recommendedMode}</span>
                </div>
              </div>

              <Button asChild className="w-full justify-center rounded-xl font-extrabold">
                <Link href={`/app/library/experiences/${lesson.id}`}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Připravit hodinu
                </Link>
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
