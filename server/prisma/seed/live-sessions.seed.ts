import 'dotenv/config';
import {
  PrismaClient,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';

/**
 * Ukázkové sady pro Bleskovky — 3 publikované testy v demo organizaci,
 * pokrývající všechny tři věkové režimy (young / middle / senior).
 * Idempotentní: existující sada (podle názvu v demo org) se přeskočí.
 *
 * Spuštění: npm run seed:live-sessions
 */
const prisma = new PrismaClient();

const ORG_NAME = 'Základní škola Demo';
const TEACHER_EMAIL = 'teacher1@zs.demo.local';

type SeedQuestion = {
  text: string;
  type: QuestionType;
  correctAnswer?: string;
  options?: string[];
  /** Interaktivní typy (MATCH_PAIRS/ORDER/SORT_BINS) — tvary viz
   *  src/shared/interactive-content.util.ts. */
  content?: object;
};

type SeedSet = {
  title: string;
  description: string;
  allowedGrades: SchoolGrade[];
  questions: SeedQuestion[];
};

const mc = (
  text: string,
  correctAnswer: string,
  options: string[],
): SeedQuestion => ({
  text,
  type: QuestionType.MULTIPLE_CHOICE,
  correctAnswer,
  options,
});

const tf = (text: string, correct: boolean): SeedQuestion => ({
  text,
  type: QuestionType.TRUE_FALSE,
  correctAnswer: String(correct),
});

/*
 * Interaktivní kola (drag & drop na tabuli) — obsah: DRAFT, čeká na redakční
 * pas (stejný režim jako reviewStatus: draft u kampaňového obsahu).
 */
const sortBins = (
  text: string,
  bins: Array<{ id: string; label: string }>,
  cards: Array<[string, string]>, // [text, binId]
): SeedQuestion => ({
  text,
  type: QuestionType.SORT_BINS,
  content: {
    bins,
    cards: cards.map(([cardText, binId], i) => ({
      id: `c${i + 1}`,
      text: cardText,
      binId,
    })),
  },
});

const order = (
  text: string,
  items: string[], // ve správném pořadí
  labels?: { start?: string; end?: string },
): SeedQuestion => ({
  text,
  type: QuestionType.ORDER,
  content: {
    items: items.map((itemText, i) => ({ id: `i${i + 1}`, text: itemText })),
    ...(labels ? { labels } : {}),
  },
});

const matchPairs = (
  text: string,
  pairs: Array<[string, string]>, // [left, right]
): SeedQuestion => ({
  text,
  type: QuestionType.MATCH_PAIRS,
  content: {
    pairs: pairs.map(([left, right], i) => ({ id: `p${i + 1}`, left, right })),
  },
});

const SETS: SeedSet[] = [
  {
    title: 'Bleskovka: Vyjmenovaná slova',
    description:
      'Ukázková sada pro 3. třídu — vyjmenovaná slova po B, L, M.',
    allowedGrades: [SchoolGrade.GRADE_3],
    questions: [
      mc('Které slovo je vyjmenované po B?', 'bydlit', [
        'bydlit',
        'bít',
        'zbíječka',
        'bílý',
      ]),
      tf('Slovo „mlýn" píšeme s tvrdým Y.', true),
      mc('Doplň: kob_la', 'y', ['y', 'i']),
      tf('Slovo „lyže" patří mezi vyjmenovaná slova po L.', true),
      mc('Které slovo NENÍ vyjmenované po M?', 'mír', [
        'mír',
        'myš',
        'mýdlo',
        'hmyz',
      ]),
      tf('Ve slově „bicykl" píšeme po B měkké I.', true),
      sortBins(
        'Roztřiďte slova do správných košů!',
        [
          { id: 'y', label: 'Píšeme Y/Ý' },
          { id: 'i', label: 'Píšeme I/Í' },
        ],
        [
          ['m_š', 'y'], // myš
          ['m_dlo', 'y'], // mýdlo
          ['l_že', 'y'], // lyže
          ['ob_vatel', 'y'], // obyvatel
          ['bic_kl', 'i'], // bicykl
          ['l_tovat', 'i'], // litovat
          ['m_nus', 'i'], // mínus
          ['b_lek', 'i'], // bílek
        ],
      ),
    ],
  },
  {
    title: 'Bleskovka: Zlomky',
    description: 'Ukázková sada pro 7. třídu — sčítání a krácení zlomků.',
    allowedGrades: [SchoolGrade.GRADE_7],
    questions: [
      mc('Kolik je 1/2 + 1/4?', '3/4', ['3/4', '2/6', '1/6', '2/4']),
      tf('Zlomek 6/8 lze zkrátit na 3/4.', true),
      mc('Kolik je 2/3 z 12?', '8', ['8', '6', '9', '4']),
      mc('Který zlomek je největší?', '5/6', ['5/6', '3/4', '2/3', '7/12']),
      tf('Zlomky 2/5 a 4/10 mají stejnou hodnotu.', true),
      mc('Kolik je 3/4 − 1/2?', '1/4', ['1/4', '2/2', '1/2', '2/4']),
      order(
        'Seřaďte zlomky od nejmenšího po největší.',
        ['1/4', '1/3', '1/2', '2/3', '3/4'],
        { start: 'nejmenší', end: 'největší' },
      ),
    ],
  },
  {
    title: 'Bleskovka: Literatura 20. století',
    description:
      'Ukázková sada pro SŠ — čeští autoři a směry 20. století.',
    allowedGrades: [
      SchoolGrade.HIGH_SCHOOL_YEAR_2,
      SchoolGrade.HIGH_SCHOOL_YEAR_3,
    ],
    questions: [
      mc('Kdo napsal román „Osudy dobrého vojáka Švejka"?', 'Jaroslav Hašek', [
        'Jaroslav Hašek',
        'Karel Čapek',
        'Bohumil Hrabal',
        'Vladislav Vančura',
      ]),
      tf('Karel Čapek je autorem dramatu R.U.R., kde poprvé zaznělo slovo „robot".', true),
      mc('Který směr charakterizuje poezii Vítězslava Nezvala 20. let?', 'poetismus', [
        'poetismus',
        'ruralismus',
        'naturalismus',
        'klasicismus',
      ]),
      mc('Kdo je autorem novely „Ostře sledované vlaky"?', 'Bohumil Hrabal', [
        'Bohumil Hrabal',
        'Milan Kundera',
        'Josef Škvorecký',
        'Arnošt Lustig',
      ]),
      tf('Jaroslav Seifert získal Nobelovu cenu za literaturu.', true),
      mc('Ve kterém roce vyšla Kunderova „Nesnesitelná lehkost bytí"?', '1984', [
        '1984',
        '1968',
        '1977',
        '1990',
      ]),
      matchPairs('Přiřaďte autora ke směru či proudu.', [
        ['Vítězslav Nezval', 'poetismus'],
        ['Jiří Wolker', 'proletářská poezie'],
        ['Václav Havel', 'absurdní drama'],
        ['Josef Škvorecký', 'exilová próza'],
      ]),
    ],
  },
];

async function main(): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { name: ORG_NAME, deletedAt: null },
    select: { id: true },
  });
  if (!org) {
    throw new Error(
      `Demo organizace „${ORG_NAME}" neexistuje — spusť nejdřív demo seed.`,
    );
  }

  const teacher = await prisma.membership.findFirst({
    where: {
      organizationId: org.id,
      deletedAt: null,
      user: { email: TEACHER_EMAIL },
    },
    select: { id: true },
  });
  if (!teacher) {
    throw new Error(`Učitel ${TEACHER_EMAIL} nemá membership v demo org.`);
  }

  for (const set of SETS) {
    const existing = await prisma.test.findFirst({
      where: { organizationId: org.id, title: set.title, deletedAt: null },
      select: {
        id: true,
        questions: { select: { id: true, text: true }, orderBy: { order: 'asc' } },
      },
    });
    if (existing) {
      // Sada už existuje: doplň jen otázky, které chybí (podle textu) —
      // typicky nová interaktivní kola do dřívějšího seedu.
      const known = new Set(existing.questions.map((q) => q.text));
      const missing = set.questions.filter((q) => !known.has(q.text));
      if (missing.length === 0) {
        console.log(`↷ „${set.title}" už existuje — přeskočeno.`);
        continue;
      }
      let nextOrder = existing.questions.length;
      for (const q of missing) {
        nextOrder += 1;
        await prisma.question.create({
          data: {
            testId: existing.id,
            text: q.text,
            type: q.type,
            order: nextOrder,
            correctAnswer: q.correctAnswer ?? null,
            ...(q.content ? { content: q.content } : {}),
            ...(q.options?.length
              ? { options: { create: q.options.map((text) => ({ text })) } }
              : {}),
          },
        });
      }
      console.log(`✚ „${set.title}": doplněno ${missing.length} otázek.`);
      continue;
    }

    await prisma.test.create({
      data: {
        organizationId: org.id,
        creatorId: teacher.id,
        title: set.title,
        description: set.description,
        allowedGrades: set.allowedGrades,
        status: PublishStatus.PUBLISHED,
        publishedAt: new Date(),
        questions: {
          create: set.questions.map((q, i) => ({
            text: q.text,
            type: q.type,
            order: i + 1,
            correctAnswer: q.correctAnswer ?? null,
            ...(q.content ? { content: q.content } : {}),
            ...(q.options?.length
              ? { options: { create: q.options.map((text) => ({ text })) } }
              : {}),
          })),
        },
      },
    });
    console.log(`✔ Vytvořena sada „${set.title}" (${set.questions.length} otázek).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
