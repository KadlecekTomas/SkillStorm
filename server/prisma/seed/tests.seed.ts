import {
  PrismaClient,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import {
  CATALOG_SUBJECT_IDS,
  CATALOG_TOPIC_IDS,
  DEFAULT_GRADE,
  ORG_IDS,
  TEST_IDS,
} from './seed-constants';
import { getMembershipId, logDone, logStep, SEED_USERS } from './seed-helpers';

type SeedQuestionDefinition = {
  text: string;
  type: QuestionType;
  score: number;
  correctAnswer?: string;
  correctAnswers?: string[];
  options?: string[];
};

type SeedTestDefinition = {
  id: string;
  title: string;
  catalogTopicId: string;
  questions: SeedQuestionDefinition[];
};

const TEST_DEFINITIONS: SeedTestDefinition[] = [
  {
    id: TEST_IDS.mathFractions,
    title: 'Matematika – Zlomky',
    catalogTopicId: CATALOG_TOPIC_IDS.mathFractions,
    questions: [
      {
        text: 'Kolik je 1/2 + 1/3?',
        type: QuestionType.FILL_IN_THE_BLANK,
        score: 1,
        correctAnswer: '5/6',
      },
      {
        text: 'Který zlomek je větší?',
        type: QuestionType.MULTIPLE_CHOICE,
        score: 1,
        options: ['1/4', '3/4', '2/5'],
        correctAnswers: ['3/4'],
      },
      {
        text: 'Platí 1/4 + 1/4 = 1/2?',
        type: QuestionType.TRUE_FALSE,
        score: 1,
        correctAnswer: 'true',
      },
    ],
  },
  {
    id: TEST_IDS.mathEquations,
    title: 'Matematika – Rovnice',
    catalogTopicId: CATALOG_TOPIC_IDS.mathEquations,
    questions: [
      {
        text: 'Vyřeš rovnici: x + 3 = 7',
        type: QuestionType.FILL_IN_THE_BLANK,
        score: 1,
        correctAnswer: '4',
      },
      {
        text: 'Vyřeš rovnici: 2x = 10',
        type: QuestionType.FILL_IN_THE_BLANK,
        score: 1,
        correctAnswer: '5',
      },
      {
        text: 'Rovnice obsahuje neznámou.',
        type: QuestionType.TRUE_FALSE,
        score: 1,
        correctAnswer: 'true',
      },
    ],
  },
  {
    id: TEST_IDS.mathPercentages,
    title: 'Matematika – Procenta',
    catalogTopicId: CATALOG_TOPIC_IDS.mathPercentages,
    questions: [
      {
        text: 'Kolik je 10 % z 200?',
        type: QuestionType.FILL_IN_THE_BLANK,
        score: 1,
        correctAnswer: '20',
      },
      {
        text: 'Platí 50 % = 1/2?',
        type: QuestionType.TRUE_FALSE,
        score: 1,
        correctAnswer: 'true',
      },
      {
        text: 'Kolik je 25 % z 80?',
        type: QuestionType.FILL_IN_THE_BLANK,
        score: 1,
        correctAnswer: '20',
      },
    ],
  },
];

export async function seed(prisma: PrismaClient) {
  logStep('Tests > creating diagnostic-friendly math tests');

  const [teacherMembershipId, academicYear, mathSubject] = await Promise.all([
    getMembershipId(prisma, SEED_USERS.teacher, ORG_IDS.chodovicka),
    prisma.academicYear.findUniqueOrThrow({
      where: { id: '99999999-aaaa-4000-b000-000000000080' },
      select: { id: true },
    }),
    prisma.subject.findFirstOrThrow({
      where: {
        OR: [
          { catalogSubjectId: CATALOG_SUBJECT_IDS.math },
          { name: 'Matematika' },
        ],
      },
      select: { id: true },
    }),
  ]);

  for (const testDef of TEST_DEFINITIONS) {
    const topicLevel = await prisma.topicLevel.findFirst({
      where: {
        catalogTopicId: testDef.catalogTopicId,
        subjectLevel: {
          subjectId: mathSubject.id,
          grade: DEFAULT_GRADE,
        },
      },
      select: { id: true },
    });

    if (!topicLevel) {
      throw new Error(`TopicLevel missing for test ${testDef.title}`);
    }

    const test = await prisma.test.upsert({
      where: { id: testDef.id },
      update: {
        organizationId: ORG_IDS.chodovicka,
        title: testDef.title,
        description: `Diagnostický test pro téma ${testDef.title}`,
        subjectId: mathSubject.id,
        academicYearId: academicYear.id,
        allowedGrades: [SchoolGrade.GRADE_6],
        status: PublishStatus.PUBLISHED,
        creatorId: teacherMembershipId,
      },
      create: {
        id: testDef.id,
        organizationId: ORG_IDS.chodovicka,
        title: testDef.title,
        description: `Diagnostický test pro téma ${testDef.title}`,
        subjectId: mathSubject.id,
        academicYearId: academicYear.id,
        allowedGrades: [SchoolGrade.GRADE_6],
        status: PublishStatus.PUBLISHED,
        creatorId: teacherMembershipId,
      },
    });

    const hasSubmissionData =
      (await prisma.submission.count({
        where: { testId: test.id },
      })) > 0;

    if (!hasSubmissionData) {
      await prisma.option.deleteMany({
        where: {
          question: { testId: test.id },
        },
      });
      await prisma.answer.deleteMany({
        where: {
          question: { testId: test.id },
        },
      });
      await prisma.question.deleteMany({
        where: { testId: test.id },
      });

      for (const [index, question] of testDef.questions.entries()) {
        await prisma.question.create({
          data: {
            testId: test.id,
            text: question.text,
            type: question.type,
            order: index + 1,
            score: question.score,
            correctAnswer: question.correctAnswer ?? null,
            correctAnswers: question.correctAnswers ?? [],
            ...(question.options
              ? {
                  options: {
                    create: question.options.map((text) => ({ text })),
                  },
                }
              : {}),
          },
        });
      }
    }

    await prisma.testAssignment.upsert({
      where: {
        topicLevelId_testId: {
          topicLevelId: topicLevel.id,
          testId: test.id,
        },
      },
      update: { isPrimary: true },
      create: {
        testId: test.id,
        topicLevelId: topicLevel.id,
        isPrimary: true,
      },
    });
  }

  const missingLinks = await prisma.test.findMany({
    where: {
      id: { in: Object.values(TEST_IDS) },
      assignments: { none: {} },
    },
    select: { id: true, title: true },
  });
  if (missingLinks.length > 0) {
    throw new Error(
      `Seed invariant failed: tests missing topic assignments: ${missingLinks
        .map((item) => item.title)
        .join(', ')}`,
    );
  }

  logDone('Diagnostic math tests ready');
}
