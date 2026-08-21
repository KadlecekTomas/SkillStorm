import type { YearPlanExpansionMap } from '@/content-packs/content-pack.types';

/**
 * IT-0 already defines the recommended whole-year sequence. Chodovická's ŠVP
 * gives encoding more granularity than the two STANDARD_32 slots, so the detailed
 * reusable content expands those slots instead of creating a competing year plan.
 * A school adapter may choose this expansion, keep the canonical two-slot pace,
 * or use only selected Lesson Experiences.
 */
export const grade6EncodingYearPlanExpansion: YearPlanExpansionMap = {
  parentYearPackId: 'skillstorm-informatics-zs-4-9',
  strategy: 'EXPAND',
  mappings: [
    {
      yearPlanLessonId: 'IT-G6-L04',
      lessonRefs: [
        'inf-g6-encoding-01-symbols-and-codes',
        'inf-g6-encoding-02-image-as-data',
        'inf-g6-encoding-03-code-vs-cipher',
      ],
      note:
        'Expands the canonical text/image encoding slot into three reusable lessons when the school ŠVP gives representation, image encoding and encryption separate emphasis.',
    },
    {
      yearPlanLessonId: 'IT-G6-L05',
      lessonRefs: ['inf-g6-encoding-04-transmission-integrity'],
      note:
        'Materializes the transmission/error-control part of the canonical trade-off slot. Compression remains an explicit follow-up gap.',
    },
  ],
};
