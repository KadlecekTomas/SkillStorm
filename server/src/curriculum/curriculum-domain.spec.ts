import { SchoolGrade } from '@prisma/client';
import {
  AmbiguousCurriculumApplicabilityError,
  curriculumChecksum,
  diffFrameworkOutcomes,
  pickCurriculumApplicability,
} from './curriculum-domain';

describe('curriculum domain invariants', () => {
  describe('curriculumChecksum', () => {
    it('is stable across object key ordering', () => {
      expect(
        curriculumChecksum({
          b: 2,
          nested: { z: true, a: 'first' },
          a: 1,
        }),
      ).toBe(
        curriculumChecksum({
          a: 1,
          nested: { a: 'first', z: true },
          b: 2,
        }),
      );
    });

    it('changes when curriculum-significant content changes', () => {
      expect(curriculumChecksum({ title: 'Původní text' })).not.toBe(
        curriculumChecksum({ title: 'Nový text' }),
      );
    });
  });

  describe('diffFrameworkOutcomes', () => {
    it('detects add/remove/text/code/field/metadata changes deterministically', () => {
      const previous = [
        {
          externalCode: 'OLD-CODE',
          sourceAnchor: 'stable-1',
          fieldExternalCode: 'INF',
          title: 'Původní text',
          description: 'Původní popis',
          metadata: { node: 5 },
        },
        {
          externalCode: 'REMOVE-ME',
          sourceAnchor: 'stable-2',
          fieldExternalCode: 'INF',
          title: 'Odstraněný outcome',
          metadata: null,
        },
      ];
      const next = [
        {
          externalCode: 'NEW-CODE',
          sourceAnchor: 'stable-1',
          fieldExternalCode: 'MAT',
          title: 'Nový text',
          description: 'Nový popis',
          metadata: { node: 9 },
        },
        {
          externalCode: 'ADDED',
          sourceAnchor: 'stable-3',
          fieldExternalCode: 'INF',
          title: 'Přidaný outcome',
          metadata: null,
        },
      ];

      expect(diffFrameworkOutcomes(previous, next)).toEqual([
        {
          type: 'CODE_CHANGED',
          identity: 'stable-1',
          previousCode: 'OLD-CODE',
          nextCode: 'NEW-CODE',
        },
        {
          type: 'FIELD_MOVED',
          identity: 'stable-1',
          previousCode: 'OLD-CODE',
          nextCode: 'NEW-CODE',
        },
        {
          type: 'TEXT_CHANGED',
          identity: 'stable-1',
          previousCode: 'OLD-CODE',
          nextCode: 'NEW-CODE',
        },
        {
          type: 'METADATA_CHANGED',
          identity: 'stable-1',
          previousCode: 'OLD-CODE',
          nextCode: 'NEW-CODE',
        },
        {
          type: 'REMOVED_OUTCOME',
          identity: 'stable-2',
          previousCode: 'REMOVE-ME',
        },
        {
          type: 'ADDED_OUTCOME',
          identity: 'stable-3',
          nextCode: 'ADDED',
        },
      ]);
    });
  });

  describe('pickCurriculumApplicability', () => {
    const defaults = [
      {
        id: 'legacy-default',
        classSectionId: null,
        grade: null,
        priority: 0,
        version: 'legacy',
      },
      {
        id: 'new-grade-6',
        classSectionId: null,
        grade: SchoolGrade.GRADE_6,
        priority: 0,
        version: 'new',
      },
    ];

    it('supports legacy + new curriculum in one school by grade', () => {
      expect(
        pickCurriculumApplicability(
          defaults,
          'class-6a',
          SchoolGrade.GRADE_6,
        )?.version,
      ).toBe('new');
      expect(
        pickCurriculumApplicability(
          defaults,
          'class-8a',
          SchoolGrade.GRADE_8,
        )?.version,
      ).toBe('legacy');
    });

    it('prefers a class override over grade and school-wide defaults', () => {
      const selected = pickCurriculumApplicability(
        [
          ...defaults,
          {
            id: 'class-6a-special',
            classSectionId: 'class-6a',
            grade: null,
            priority: -10,
            version: 'class-special',
          },
        ],
        'class-6a',
        SchoolGrade.GRADE_6,
      );
      expect(selected?.version).toBe('class-special');
    });

    it('uses priority only inside the same specificity', () => {
      const selected = pickCurriculumApplicability(
        [
          {
            id: 'grade-low',
            classSectionId: null,
            grade: SchoolGrade.GRADE_7,
            priority: 1,
          },
          {
            id: 'grade-high',
            classSectionId: null,
            grade: SchoolGrade.GRADE_7,
            priority: 100,
          },
        ],
        'class-7a',
        SchoolGrade.GRADE_7,
      );
      expect(selected?.id).toBe('grade-high');
    });

    it('returns null when no applicability matches the class and grade', () => {
      expect(
        pickCurriculumApplicability(
          [
            {
              id: 'grade-5-only',
              classSectionId: null,
              grade: SchoolGrade.GRADE_5,
              priority: 0,
            },
          ],
          'class-9a',
          SchoolGrade.GRADE_9,
        ),
      ).toBeNull();
    });

    it('fails explicitly instead of selecting a random equally ranked row', () => {
      expect(() =>
        pickCurriculumApplicability(
          [
            {
              id: 'amb-a',
              classSectionId: null,
              grade: SchoolGrade.GRADE_8,
              priority: 4,
            },
            {
              id: 'amb-b',
              classSectionId: null,
              grade: SchoolGrade.GRADE_8,
              priority: 4,
            },
          ],
          'class-8a',
          SchoolGrade.GRADE_8,
        ),
      ).toThrow(AmbiguousCurriculumApplicabilityError);
    });
  });
});
