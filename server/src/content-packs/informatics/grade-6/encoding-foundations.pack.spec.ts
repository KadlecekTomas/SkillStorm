import { validateActivityPublicationMetadata } from '@/activity-engine/activity-publication';
import { fzsChodovicka2023Grade6InformaticsAdapter } from '@/content-packs/informatics/adapters/fzs-chodovicka-2023-grade-6.adapter';
import { validateLessonDefinition } from '@/lesson-experience/lesson-publication';
import type { CreateLessonExperienceVersionDto } from '@/lesson-experience/dto/lesson-experience.dto';
import { grade6EncodingFoundationsPack } from './encoding-foundations.pack';
import { grade6EncodingYearPlanExpansion } from './encoding-foundations.year-plan';

const RESOLVED_ACTIVITY_VERSION_ID = '00000000-0000-4000-8000-000000000001';

function resolveAuthoredLesson(
  lessonIndex: number,
): CreateLessonExperienceVersionDto {
  const authored = grade6EncodingFoundationsPack.lessons[lessonIndex]!.version;
  return {
    ...authored,
    stages: authored.stages.map((stage) => {
      const { activityRef, ...rest } = stage;
      return {
        ...rest,
        ...(activityRef
          ? { activityVersionId: RESOLVED_ACTIVITY_VERSION_ID }
          : {}),
      };
    }),
  };
}

describe('grade6EncodingFoundationsPack', () => {
  it('keeps the universal content independent from one school', () => {
    const serialized = JSON.stringify(grade6EncodingFoundationsPack);

    expect(serialized).not.toMatch(/Chodovick/i);
    expect(serialized).not.toMatch(/FZŠ/i);
    expect(serialized).not.toMatch(/Praha 9/i);
  });

  it('contains four complete 45-minute lesson experiences', () => {
    expect(grade6EncodingFoundationsPack.lessons).toHaveLength(4);

    for (const lesson of grade6EncodingFoundationsPack.lessons) {
      const duration = lesson.version.stages.reduce(
        (sum, stage) => sum + stage.durationMin,
        0,
      );
      expect(duration).toBe(45);
      expect(lesson.version.estimatedDurationMin).toBe(45);
    }
  });

  it('references only activities that exist in the same universal pack', () => {
    const activitySlugs = new Set(
      grade6EncodingFoundationsPack.activities.map(
        (activity) => activity.shell.slug,
      ),
    );

    for (const lesson of grade6EncodingFoundationsPack.lessons) {
      for (const stage of lesson.version.stages) {
        if (stage.activityRef) {
          expect(activitySlugs.has(stage.activityRef)).toBe(true);
        }
      }
    }
  });

  it('passes the current Activity publication contract', () => {
    for (const activity of grade6EncodingFoundationsPack.activities) {
      expect(() =>
        validateActivityPublicationMetadata(activity.version),
      ).not.toThrow();
    }
  });

  it('passes the current Lesson Experience publication contract after stable refs are resolved', () => {
    for (
      let index = 0;
      index < grade6EncodingFoundationsPack.lessons.length;
      index += 1
    ) {
      expect(() => validateLessonDefinition(resolveAuthoredLesson(index))).not.toThrow();
    }
  });

  it('uses external curriculum identifiers instead of database UUIDs', () => {
    for (const activity of grade6EncodingFoundationsPack.activities) {
      for (const mapping of activity.curriculum) {
        expect(mapping.frameworkCode).toBe('CZ_RVP_ZV');
        expect(mapping.outcomeExternalCode).toBe('INF-INF-001-ZV9-002');
        expect(mapping.outcomeExternalCode).not.toMatch(
          /^[0-9a-f]{8}-[0-9a-f-]{27}$/i,
        );
      }
    }
  });

  it('expands the existing IT-0 year pack instead of creating a second year plan', () => {
    const lessonSlugs = new Set(
      grade6EncodingFoundationsPack.lessons.map((lesson) => lesson.shell.slug),
    );

    expect(grade6EncodingYearPlanExpansion.parentYearPackId).toBe(
      'skillstorm-informatics-zs-4-9',
    );
    expect(grade6EncodingYearPlanExpansion.strategy).toBe('EXPAND');
    expect(
      grade6EncodingYearPlanExpansion.mappings.map(
        (mapping) => mapping.yearPlanLessonId,
      ),
    ).toEqual(['IT-G6-L04', 'IT-G6-L05']);

    for (const mapping of grade6EncodingYearPlanExpansion.mappings) {
      for (const lessonRef of mapping.lessonRefs) {
        expect(lessonSlugs.has(lessonRef)).toBe(true);
      }
    }
  });
});

describe('FZŠ Chodovická grade 6 adapter', () => {
  it('maps school provenance separately from universal content', () => {
    expect(fzsChodovicka2023Grade6InformaticsAdapter.entries).toHaveLength(12);
    expect(fzsChodovicka2023Grade6InformaticsAdapter.adapterId).toBe(
      'FZS_CHODOVICKA_2023_INF_G6',
    );
  });

  it('never marks a school outcome covered without a concrete lesson', () => {
    for (const entry of fzsChodovicka2023Grade6InformaticsAdapter.entries) {
      if (entry.coverage === 'COVERED') {
        expect(entry.lessonRefs.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every universal lesson reference resolvable', () => {
    const lessonSlugs = new Set(
      grade6EncodingFoundationsPack.lessons.map((lesson) => lesson.shell.slug),
    );

    for (const entry of fzsChodovicka2023Grade6InformaticsAdapter.entries) {
      for (const lessonRef of entry.lessonRefs) {
        expect(lessonSlugs.has(lessonRef)).toBe(true);
      }
    }
  });

  it('keeps known gaps explicit instead of inflating coverage', () => {
    const binaryLogic = fzsChodovicka2023Grade6InformaticsAdapter.entries.find(
      (entry) => entry.sourceOutcomeKey === 'INF6-07',
    );
    const tableVsGraph =
      fzsChodovicka2023Grade6InformaticsAdapter.entries.find(
        (entry) => entry.sourceOutcomeKey === 'INF6-08',
      );

    expect(binaryLogic?.coverage).toBe('GAP');
    expect(tableVsGraph?.coverage).toBe('PARTIAL');
  });
});
