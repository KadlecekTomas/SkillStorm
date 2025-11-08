import {
  PrismaClient,
  PublishStatus,
  QuestionType,
} from '@prisma/client';
import {
  CATALOG_TOPIC_IDS,
  ORG_IDS,
  TEST_IDS,
} from './seed-constants';
import {
  getMembershipId,
  logDone,
  logStep,
  SEED_USERS,
} from './seed-helpers';

const TEST_DEFINITIONS = [
  {
    id: TEST_IDS.math,
    title: 'Matematika – diagnostický test',
    catalogTopicId: CATALOG_TOPIC_IDS.mathFractions,
    questions: [
      {
        text: 'Doplň výsledek: 5/6 + 1/6 = ?',
        type: QuestionType.FILL_IN_THE_BLANK,
        score: 2,
        correctAnswer: '1',
      },
      {
        text: 'Vyber pravdivé tvrzení o trojúhelníku.',
        type: QuestionType.MULTIPLE_CHOICE,
        score: 1,
        options: [
          'Součet vnitřních úhlů je 360°',
          'Součet vnitřních úhlů je 180°',
          'Každá strana je stejně dlouhá',
        ],
        correctAnswers: ['Součet vnitřních úhlů je 180°'],
      },
    ],
  },
  {
    id: TEST_IDS.english,
    title: 'Angličtina – slovní zásoba',
    catalogTopicId: CATALOG_TOPIC_IDS.englishVocabulary,
    questions: [
      {
        text: 'Doplň překlad: "improve" znamená ______.',
        type: QuestionType.FILL_IN_THE_BLANK,
        score: 1,
        correctAnswer: 'vylepšit',
      },
      {
        text: 'Vyber synonyma slova "happy".',
        type: QuestionType.MULTIPLE_CHOICE,
        score: 2,
        options: ['joyful', 'sad', 'delighted', 'angry'],
        correctAnswers: ['joyful', 'delighted'],
      },
    ],
  },
  {
    id: TEST_IDS.informatics,
    title: 'Informatika – algoritmické myšlení',
    catalogTopicId: CATALOG_TOPIC_IDS.itAlgorithms,
    questions: [
      {
        text: 'Jaký je první krok při řešení problému?',
        type: QuestionType.MULTIPLE_CHOICE,
        score: 1,
        options: ['Implementace', 'Analýza zadání', 'Testování'],
        correctAnswers: ['Analýza zadání'],
      },
      {
        text: 'Doplň: ______ je strukturovaný soubor kroků vedoucí k cíli.',
        type: QuestionType.FILL_IN_THE_BLANK,
        score: 1,
        correctAnswer: 'Algoritmus',
      },
      {
        text: 'Které příkazy patří mezi řídicí struktury?',
        type: QuestionType.MULTIPLE_CHOICE,
        score: 2,
        options: ['if', 'for', 'print', 'return'],
        correctAnswers: ['if', 'for'],
      },
    ],
  },
];

export async function seed(prisma: PrismaClient) {
  logStep('Tests > creating sample tests');

  await prisma.testAssignment.deleteMany({});
  await prisma.option.deleteMany({});
  await prisma.answer.deleteMany({});
  await prisma.question.deleteMany({});

  const teacherMembershipId = await getMembershipId(
    prisma,
    SEED_USERS.teacher,
    ORG_IDS.chodovicka,
  );

  for (const testDef of TEST_DEFINITIONS) {
    // Najdi příslušný topicLevel
    const topicLevel = await prisma.topicLevel.findFirst({
      where: {
        catalogTopicId: testDef.catalogTopicId,
        subjectLevel: {
          subject: { organizationId: ORG_IDS.chodovicka },
        },
      },
      select: { id: true },
    });

    if (!topicLevel) {
      console.warn(`⚠️ Tests > TopicLevel not found for ${testDef.title}, skipping.`);
      continue;
    }

    let test;

    try {
      test = await prisma.test.create({
        data: {
          id: testDef.id,
          organizationId: ORG_IDS.chodovicka,
          title: testDef.title,
          description: `Ukázkový test pro téma ${testDef.title}`,
          status: PublishStatus.PUBLISHED,
          creatorId: teacherMembershipId,
          questions: {
            create: testDef.questions.map((q, i) => ({
              text: q.text,
              type: q.type,
              order: i + 1,
              score: q.score,
              correctAnswer: q.correctAnswer,
              correctAnswers: q.correctAnswers,
              options: q.options
                ? { create: q.options.map((opt) => ({ text: opt })) }
                : undefined,
            })),
          },
        },
      });
      console.log(`✅ Tests > Created new test: ${testDef.title}`);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        test = await prisma.test.update({
          where: { id: testDef.id },
          data: {
            title: testDef.title,
            description: `${testDef.title} – refreshed`,
            status: PublishStatus.PUBLISHED,
          },
        });
        console.log(
          `⚠️ Tests > Duplicate test found, updated instead: ${testDef.title}`,
        );
      } else {
        throw err;
      }
    }

    // 🔗 Vazba na topicLevel
    await prisma.testAssignment.upsert({
      where: {
        topicLevelId_testId: {
          topicLevelId: topicLevel.id,
          testId: test.id,
        },
      },
      update: {},
      create: {
        testId: test.id,
        topicLevelId: topicLevel.id,
        isPrimary: true,
      },
    });

    console.log(`✅ Tests > Linked ${testDef.title} to topic level ${topicLevel.id}`);
  }

  logDone('Tests ready');
}
