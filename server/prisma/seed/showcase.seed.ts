import 'dotenv/config';
import {
  $Enums,
  CampaignProgressStatus,
  CampaignType,
  ContentScope,
  ContentType,
  EducationLevel,
  EnrollmentStatus,
  OrganizationRole,
  PrismaClient,
  PublishStatus,
  QuestionType,
  SchoolGrade,
  SubmissionStatus,
  TopicPhase,
} from '@prisma/client';
import { hashPassword, logDone, logStep } from './seed-helpers';

/**
 * SHOWCASE SEED — scénografie pro vizuální QA a portfolio screenshoty.
 *
 * „ZŠ a Gymnázium Jasmínová": realistická, HEZKÁ data — rozehrané stavy,
 * rozptyl výsledků, kampaně v půlce, XP historie. Smyšlená česká jména.
 * Idempotentní: při každém běhu smaže a znovu postaví JEN vlastní org
 * (doména @jasminova.test) — e2e/scénářové seedy se nedotýká.
 *
 * Účty (heslo Password123!):
 *   reditel@jasminova.test   – ředitelka
 *   ucitel@jasminova.test    – učitel s více třídami (5.A homeroom + úvazky)
 *   zak2b@jasminova.test     – žákyně 2.B (young režim)
 *   zak8a@jasminova.test     – žák 8.A (old režim, XP historie)
 *   zakg2@jasminova.test     – studentka G2
 */

const prisma = new PrismaClient();

const ORG_NAME = 'ZŠ a Gymnázium Jasmínová';
const DOMAIN = 'jasminova.test';
const PASSWORD = 'Password123!';

/** Smyšlená jména — žádné reálné osoby. */
const NAMES_2B = [
  'Anička Malá',
  'Vojta Hruška',
  'Ema Doležalová',
  'Kuba Veselý',
  'Terezka Bílá',
  'Matyáš Kolář',
  'Laura Fialová',
  'Šimon Dvořáček',
];
const NAMES_5A = [
  'Ondřej Blažek',
  'Klára Vlčková',
  'Tomáš Urban',
  'Nela Šimková',
  'Filip Marek',
  'Rozárka Benešová',
  'David Poláček',
  'Julie Vaňková',
  'Adam Krejčí',
  'Sofie Horáková',
];
const NAMES_8A = [
  'Ondřej Sýkora',
  'Barbora Jelínková',
  'Marek Říha',
  'Eliška Novotná',
  'Jakub Starý',
  'Viktorie Malinová',
  'Petr Zeman',
  'Adéla Křížová',
  'Lukáš Tichý',
  'Karolína Sedláčková',
  'Martin Vávra',
  'Tereza Šťastná',
];
const NAMES_G2 = [
  'Alžběta Konečná',
  'Vít Bartoš',
  'Natálie Musilová',
  'Štěpán Kadlec',
  'Amálie Pokorná',
  'Daniel Čermák',
  'Linda Urbanová',
  'Radim Holub',
];

function emailFor(name: string) {
  const ascii = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '')
    .trim()
    .replace(/ +/g, '.');
  return `${ascii}@${DOMAIN}`;
}

/** Deterministický pseudonáhod — ať screenshoty vypadají pokaždé stejně. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260717);

function daysAgo(n: number, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Wipe — jen vlastní org + uživatelé @jasminova.test
// ---------------------------------------------------------------------------
async function wipe() {
  logStep('Mažu předchozí showcase data…');
  const orgs = await prisma.organization.findMany({
    where: { name: ORG_NAME },
    select: { id: true },
  });
  const orgIds = orgs.map((o) => o.id);
  if (orgIds.length) {
    const inOrg = { organizationId: { in: orgIds } };
    await prisma.submission.updateMany({
      where: { ...inOrg, submittedAt: { not: null } },
      data: { submittedAt: null },
    });
    await prisma.response.deleteMany({
      where: { submission: inOrg },
    });
    await prisma.submission.deleteMany({ where: inOrg });
    await prisma.assignment.deleteMany({ where: inOrg });
    await prisma.question.deleteMany({ where: { test: inOrg } });
    await prisma.campaignStepUnlock.deleteMany({
      where: { progress: inOrg },
    });
    await prisma.campaignProgress.deleteMany({ where: inOrg });
    await prisma.classPartakXpEvent.deleteMany({
      where: { classPartak: inOrg },
    });
    await prisma.classPartak.deleteMany({ where: inOrg });
    await prisma.liveSession.deleteMany({ where: inOrg });
    await prisma.test.deleteMany({ where: inOrg });
    await prisma.learningMaterial.deleteMany({ where: inOrg });
    await prisma.enrollment.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.student.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.teacherClassSection.deleteMany({
      where: { classSection: { orgId: { in: orgIds } } },
    });
    await prisma.teacher.deleteMany({ where: inOrg });
    await prisma.classSection.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.auditLog.deleteMany({ where: inOrg });
    await prisma.membership.deleteMany({ where: inOrg });
    await prisma.academicYear.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${DOMAIN}` } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

// ---------------------------------------------------------------------------
// Katalog (globální řádky → stabilní kódy, upsert)
// ---------------------------------------------------------------------------
async function ensureCatalog() {
  const mkSubject = async (
    code: string,
    name: string,
    grades: { grade: SchoolGrade; order: number; label: string }[],
    topics: string[],
  ) => {
    const catalogSubject = await prisma.catalogSubject.upsert({
      where: { code },
      update: { name, isActive: true, deletedAt: null },
      create: { code, name, isActive: true },
    });
    const subject =
      (await prisma.subject.findFirst({
        where: { catalogSubjectId: catalogSubject.id },
      })) ??
      (await prisma.subject.create({
        data: {
          catalogSubjectId: catalogSubject.id,
          name,
          gradeFrom: 1,
          gradeTo: 13,
        },
      }));

    const topicLevels: Record<string, string> = {};
    for (const g of grades) {
      const subjectLevel = await prisma.subjectLevel.upsert({
        where: { subjectId_grade: { subjectId: subject.id, grade: g.grade } },
        update: { isEnabled: true, label: g.label },
        create: {
          subjectId: subject.id,
          grade: g.grade,
          order: g.order,
          label: g.label,
          isEnabled: true,
        },
      });
      for (const [i, topicName] of topics.entries()) {
        const catalogTopic = await prisma.catalogTopic.upsert({
          where: {
            subjectId_name: { subjectId: catalogSubject.id, name: topicName },
          },
          update: { isActive: true, deletedAt: null, order: i + 1 },
          create: {
            subjectId: catalogSubject.id,
            name: topicName,
            order: i + 1,
            isActive: true,
          },
        });
        const topicLevel = await prisma.topicLevel.upsert({
          where: {
            subjectLevelId_catalogTopicId_phase: {
              subjectLevelId: subjectLevel.id,
              catalogTopicId: catalogTopic.id,
              phase: TopicPhase.INTRO,
            },
          },
          update: { name: topicName, order: i + 1 },
          create: {
            subjectLevelId: subjectLevel.id,
            catalogTopicId: catalogTopic.id,
            name: topicName,
            phase: TopicPhase.INTRO,
            order: i + 1,
          },
        });
        topicLevels[`${g.grade}:${topicName}`] = topicLevel.id;
      }
    }
    return { subject, topicLevels };
  };

  const math = await mkSubject(
    'SHOWCASE_MAT',
    'Matematika',
    [
      { grade: SchoolGrade.GRADE_5, order: 5, label: '5. ročník' },
      { grade: SchoolGrade.GRADE_8, order: 8, label: '8. ročník' },
    ],
    ['Zlomky a desetinná čísla', 'Rovnice'],
  );
  const czech = await mkSubject(
    'SHOWCASE_CJ',
    'Český jazyk',
    [
      { grade: SchoolGrade.GRADE_2, order: 2, label: '2. ročník' },
      { grade: SchoolGrade.GRADE_5, order: 5, label: '5. ročník' },
    ],
    ['Vyjmenovaná slova'],
  );
  const lit = await mkSubject(
    'SHOWCASE_LIT',
    'Literatura',
    [{ grade: SchoolGrade.HIGH_SCHOOL_YEAR_2, order: 11, label: 'G2' }],
    ['Literární moderna'],
  );
  return { math, czech, lit };
}

// ---------------------------------------------------------------------------
async function main() {
  await wipe();

  logStep('Zakládám ZŠ a Gymnázium Jasmínová…');
  const passwordHash = await hashPassword(PASSWORD);
  const org = await prisma.organization.create({
    data: { name: ORG_NAME, type: 'SCHOOL', status: 'ACTIVE' },
  });
  const year = await prisma.academicYear.create({
    data: {
      orgId: org.id,
      label: '2025/2026',
      startsAt: new Date('2025-09-01T00:00:00.000Z'),
      endsAt: new Date('2026-08-31T23:59:59.000Z'),
      isCurrent: true,
    },
  });

  const mkUser = async (email: string, name: string, role: OrganizationRole) => {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        username: email.split('@')[0]!,
        passwordHash,
        memberships: { create: { organizationId: org.id, role } },
      },
      select: { id: true, memberships: { select: { id: true } } },
    });
    return { userId: user.id, membershipId: user.memberships[0]!.id };
  };

  const director = await mkUser(
    `reditel@${DOMAIN}`,
    'Jana Květová',
    OrganizationRole.DIRECTOR,
  );
  const teacher1 = await mkUser(
    `ucitel@${DOMAIN}`,
    'Petr Jasan',
    OrganizationRole.TEACHER,
  );
  const teacher2 = await mkUser(
    `marie.liskova@${DOMAIN}`,
    'Marie Lísková',
    OrganizationRole.TEACHER,
  );
  const teacher1Row = await prisma.teacher.create({
    data: { organizationId: org.id, membershipId: teacher1.membershipId },
  });
  const teacher2Row = await prisma.teacher.create({
    data: { organizationId: org.id, membershipId: teacher2.membershipId },
  });

  // Třídy: 2.B (M. Lísková), 5.A (homeroom P. Jasan), 8.A, G2 (úvazky P. Jasan)
  const mkClass = (
    grade: SchoolGrade,
    section: string,
    label: string,
    teacherId: string | null,
  ) =>
    prisma.classSection.create({
      data: { orgId: org.id, yearId: year.id, grade, section, label, teacherId },
    });
  const class2B = await mkClass(SchoolGrade.GRADE_2, 'B', '2.B', teacher2Row.id);
  const class5A = await mkClass(SchoolGrade.GRADE_5, 'A', '5.A', teacher1Row.id);
  const class8A = await mkClass(SchoolGrade.GRADE_8, 'A', '8.A', null);
  const classG2 = await mkClass(
    SchoolGrade.HIGH_SCHOOL_YEAR_2,
    '2',
    'G2',
    null,
  );
  // Učitel s více třídami: úvazky na 2.B, 8.A i G2 (homeroom bucket bere
  // jen první homeroom třídu — proto úvazky, viz decisions kampaní bod 4).
  for (const cls of [class2B, class8A, classG2]) {
    await prisma.teacherClassSection.create({
      data: {
        teacherId: teacher1Row.id,
        classSectionId: cls.id,
        yearId: year.id,
      },
    });
  }

  logStep('Zapisuji žáky (smyšlená česká jména)…');
  const enrollClass = async (
    names: string[],
    classSectionId: string,
    pinnedEmails: Record<number, string> = {},
  ) => {
    const students: { membershipId: string; studentId: string; name: string }[] =
      [];
    for (const [i, name] of names.entries()) {
      const email = pinnedEmails[i] ?? emailFor(name);
      const member = await mkUser(email, name, OrganizationRole.STUDENT);
      const student = await prisma.student.create({
        data: { orgId: org.id, membershipId: member.membershipId },
      });
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          orgId: org.id,
          yearId: year.id,
          classSectionId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      students.push({
        membershipId: member.membershipId,
        studentId: student.id,
        name,
      });
    }
    return students;
  };

  const students2B = await enrollClass(NAMES_2B, class2B.id, {
    0: `zak2b@${DOMAIN}`,
  });
  const students5A = await enrollClass(NAMES_5A, class5A.id);
  const students8A = await enrollClass(NAMES_8A, class8A.id, {
    0: `zak8a@${DOMAIN}`,
  });
  const studentsG2 = await enrollClass(NAMES_G2, classG2.id, {
    0: `zakg2@${DOMAIN}`,
  });

  logStep('Katalog + předměty…');
  const catalog = await ensureCatalog();
  for (const { subject } of [catalog.math, catalog.czech, catalog.lit]) {
    await prisma.orgSubject.upsert({
      where: {
        organizationId_subjectId: {
          organizationId: org.id,
          subjectId: subject.id,
        },
      },
      update: { isEnabled: true },
      create: {
        organizationId: org.id,
        subjectId: subject.id,
        isEnabled: true,
        isCustom: false,
      },
    });
  }

  // -------------------------------------------------------------------------
  logStep('Testy + otázky…');
  type QuestionSpec = {
    text: string;
    type: QuestionType;
    correctAnswer?: string;
    options?: string[];
    /** Interaktivní typy (MATCH_PAIRS/ORDER/SORT_BINS) — obsah pro tabuli. */
    content?: object;
  };
  const mkTest = async (params: {
    title: string;
    description: string;
    subjectId: string;
    topicLevelId: string;
    grades: SchoolGrade[];
    status: PublishStatus;
    creatorId: string;
    questions: QuestionSpec[];
    createdDaysAgo?: number;
  }) => {
    const test = await prisma.test.create({
      data: {
        organizationId: org.id,
        academicYearId: year.id,
        subjectId: params.subjectId,
        creatorId: params.creatorId,
        title: params.title,
        description: params.description,
        allowedGrades: params.grades,
        status: params.status,
        publishedAt:
          params.status === PublishStatus.PUBLISHED
            ? daysAgo(params.createdDaysAgo ?? 21)
            : null,
        createdAt: daysAgo((params.createdDaysAgo ?? 21) + 2),
        assignments: {
          create: { topicLevelId: params.topicLevelId, isPrimary: true, order: 1 },
        },
      },
    });
    for (const [index, q] of params.questions.entries()) {
      await prisma.question.create({
        data: {
          testId: test.id,
          text: q.text,
          type: q.type,
          order: index + 1,
          score: 1,
          correctAnswer: q.correctAnswer ?? null,
          correctAnswers: [],
          ...(q.content ? { content: q.content } : {}),
          options: { create: (q.options ?? []).map((text) => ({ text })) },
        },
      });
    }
    return test;
  };

  const MC = QuestionType.MULTIPLE_CHOICE;
  const TF = QuestionType.TRUE_FALSE;

  const testZlomky = await mkTest({
    title: 'Zlomky a desetinná čísla',
    description: 'Opakování před čtvrtletní prací.',
    subjectId: catalog.math.subject.id,
    topicLevelId: catalog.math.topicLevels[`${SchoolGrade.GRADE_8}:Zlomky a desetinná čísla`]!,
    grades: [SchoolGrade.GRADE_8],
    status: PublishStatus.PUBLISHED,
    creatorId: teacher1.membershipId,
    createdDaysAgo: 24,
    questions: [
      { text: 'Kolik je 1/2 + 1/4?', type: MC, correctAnswer: '3/4', options: ['3/4', '2/6', '1/6', '2/4'] },
      { text: 'Zlomek 6/8 zkrácený na základní tvar je 3/4.', type: TF, correctAnswer: 'true' },
      { text: 'Kolik je 0,25 jako zlomek?', type: MC, correctAnswer: '1/4', options: ['1/4', '1/2', '2/5'] },
      { text: 'Kolik je 2/3 z 18?', type: MC, correctAnswer: '12', options: ['12', '9', '6'] },
      { text: 'Desetinné číslo 0,5 je větší než 3/4.', type: TF, correctAnswer: 'false' },
      { text: 'Kolik je 1/5 jako desetinné číslo?', type: MC, correctAnswer: '0,2', options: ['0,2', '0,5', '0,15'] },
      {
        // Interaktivní kolo (tabule) — obsah: draft, čeká na redakční pas
        text: 'Seřaďte zlomky od nejmenšího po největší.',
        type: QuestionType.ORDER,
        content: {
          items: [
            { id: 'i1', text: '1/4' },
            { id: 'i2', text: '1/3' },
            { id: 'i3', text: '1/2' },
            { id: 'i4', text: '2/3' },
            { id: 'i5', text: '3/4' },
          ],
          labels: { start: 'nejmenší', end: 'největší' },
        },
      },
      { text: 'Kolik je 3/4 + 1/8?', type: MC, correctAnswer: '7/8', options: ['7/8', '4/12', '5/8'] },
    ],
  });

  // Druhý čekající test pro 8.A — dashboard žáka má ukazovat 2 zadání s hezkými názvy
  const testProcenta = await mkTest({
    title: 'Procenta kolem nás',
    description: 'Slevy, úroky a DPH — počítání procent v běžných situacích.',
    subjectId: catalog.math.subject.id,
    topicLevelId: catalog.math.topicLevels[`${SchoolGrade.GRADE_8}:Rovnice`]!,
    grades: [SchoolGrade.GRADE_8],
    status: PublishStatus.PUBLISHED,
    creatorId: teacher1.membershipId,
    createdDaysAgo: 5,
    questions: [
      { text: 'Kolik je 15 % z 200 Kč?', type: MC, correctAnswer: '30 Kč', options: ['30 Kč', '15 Kč', '45 Kč'] },
      { text: 'Sleva 20 % z 500 Kč znamená novou cenu 400 Kč.', type: TF, correctAnswer: 'true' },
      { text: 'Kolik procent je 12 z 48?', type: MC, correctAnswer: '25 %', options: ['25 %', '20 %', '30 %'] },
      { text: 'Zvýšení o 50 % a následné snížení o 50 % vrátí původní cenu.', type: TF, correctAnswer: 'false' },
    ],
  });

  const testVyjmenovana = await mkTest({
    title: 'Vyjmenovaná slova po B a L',
    description: 'Bleskovková sada pro 1. stupeň.',
    subjectId: catalog.czech.subject.id,
    topicLevelId: catalog.czech.topicLevels[`${SchoolGrade.GRADE_2}:Vyjmenovaná slova`]!,
    grades: [SchoolGrade.GRADE_2, SchoolGrade.GRADE_5],
    status: PublishStatus.PUBLISHED,
    creatorId: teacher1.membershipId,
    createdDaysAgo: 18,
    questions: [
      { text: 'Které slovo je vyjmenované po B?', type: MC, correctAnswer: 'bydlit', options: ['bydlit', 'zbíječka', 'bít'] },
      { text: 'Slovo „mlýn“ píšeme s tvrdým Y.', type: TF, correctAnswer: 'true' },
      { text: 'Které slovo je vyjmenované po L?', type: MC, correctAnswer: 'slyšet', options: ['slyšet', 'lísteček', 'lížou'] },
      { text: 'Ve slově „ob_vatel“ píšeme měkké i.', type: TF, correctAnswer: 'false' },
      {
        // Interaktivní kolo (tabule) — obsah: draft, čeká na redakční pas
        text: 'Roztřiďte slova do správných košů!',
        type: QuestionType.SORT_BINS,
        content: {
          bins: [
            { id: 'y', label: 'Píšeme Y/Ý' },
            { id: 'i', label: 'Píšeme I/Í' },
          ],
          cards: [
            { id: 'k1', text: 'b_dlit', binId: 'y' },
            { id: 'k2', text: 'ml_n', binId: 'y' },
            { id: 'k3', text: 'l_že', binId: 'y' },
            { id: 'k4', text: 'ob_vatel', binId: 'y' },
            { id: 'k5', text: 'b_cykl', binId: 'i' },
            { id: 'k6', text: 'l_stek', binId: 'i' },
          ],
        },
      },
    ],
  });

  const testModerna = await mkTest({
    title: 'Literární moderna',
    description: 'Kvíz k semináři — přelom 19. a 20. století.',
    subjectId: catalog.lit.subject.id,
    topicLevelId: catalog.lit.topicLevels[`${SchoolGrade.HIGH_SCHOOL_YEAR_2}:Literární moderna`]!,
    grades: [SchoolGrade.HIGH_SCHOOL_YEAR_2],
    status: PublishStatus.PUBLISHED,
    creatorId: teacher1.membershipId,
    createdDaysAgo: 10,
    questions: [
      { text: 'Který směr zdůrazňuje osobní dojem a náladu okamžiku?', type: MC, correctAnswer: 'impresionismus', options: ['impresionismus', 'realismus', 'klasicismus'] },
      { text: 'Prokletí básníci působili především ve Francii.', type: TF, correctAnswer: 'true' },
      { text: 'Symbolismus sděluje význam především…', type: MC, correctAnswer: 'náznakem a obrazem', options: ['náznakem a obrazem', 'přesným popisem', 'statistikou'] },
      { text: 'Dekadence oslavuje běžný všední optimismus.', type: TF, correctAnswer: 'false' },
      {
        // Interaktivní kolo (tabule) — obsah: draft, čeká na redakční pas
        text: 'Přiřaďte autora ke směru.',
        type: QuestionType.MATCH_PAIRS,
        content: {
          pairs: [
            { id: 'p1', left: 'Charles Baudelaire', right: 'prokletí básníci' },
            { id: 'p2', left: 'Paul Verlaine', right: 'symbolismus' },
            { id: 'p3', left: 'Oscar Wilde', right: 'dekadence' },
            { id: 'p4', left: 'Antonín Sova', right: 'impresionismus' },
          ],
        },
      },
    ],
  });

  await mkTest({
    title: 'Lineární rovnice — koncept',
    description: 'Rozpracovaná sada na příští týden.',
    subjectId: catalog.math.subject.id,
    topicLevelId: catalog.math.topicLevels[`${SchoolGrade.GRADE_8}:Rovnice`]!,
    grades: [SchoolGrade.GRADE_8],
    status: PublishStatus.DRAFT,
    creatorId: teacher1.membershipId,
    createdDaysAgo: 3,
    questions: [
      { text: 'Řešením rovnice x + 5 = 12 je x = 7.', type: TF, correctAnswer: 'true' },
      { text: 'Kolik je x, když 3x = 21?', type: MC, correctAnswer: '7', options: ['7', '6', '9'] },
    ],
  });

  // -------------------------------------------------------------------------
  logStep('Zadání + výsledky s rozptylem (8.A, poslední 3 týdny)…');
  const assignment8A = await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: testZlomky.id,
      targetType: 'CLASS',
      classSectionId: class8A.id,
      openAt: daysAgo(21, 8),
      closeAt: daysAgo(2, 18),
      maxAttempts: 2,
      timeLimitSec: 20 * 60,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher1.membershipId,
    },
  });

  const questionsZlomky = await prisma.question.findMany({
    where: { testId: testZlomky.id },
    orderBy: { order: 'asc' },
  });

  /**
   * Skriptované odevzdání: `correct` správných odpovědí, odevzdáno před
   * `day` dny. Žádný náhod — průměry, trend mezi týdny i rizikoví žáci
   * jsou zkomponované, ať screenshoty vyprávějí stejný příběh v každém běhu.
   */
  type QuestionRow = (typeof questionsZlomky)[number];
  const submitScripted = async (params: {
    assignmentId: string;
    testId: string;
    questions: QuestionRow[];
    membershipId: string;
    correct: number;
    day: number;
  }) => {
    const submittedAt = daysAgo(
      params.day,
      8 + Math.floor(rand() * 8),
      Math.floor(rand() * 60),
    );
    const submission = await prisma.submission.create({
      data: {
        organizationId: org.id,
        studentId: params.membershipId,
        assignmentId: params.assignmentId,
        testId: params.testId,
        attemptNo: 1,
        status: SubmissionStatus.PENDING,
        responses: {
          create: params.questions.map((q, qi) => {
            const isCorrect = qi < params.correct;
            const wrong =
              q.type === TF
                ? q.correctAnswer === 'true'
                  ? 'false'
                  : 'true'
                : 'špatná odpověď';
            return {
              questionId: q.id,
              givenText: isCorrect ? (q.correctAnswer ?? '') : wrong,
              isCorrect,
              awardedPoints: isCorrect ? 1 : 0,
              maxPoints: 1,
              correctAnswerSnapshot: q.correctAnswer,
              questionTextSnapshot: q.text,
              corrected: true,
            };
          }),
        },
      },
    });
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        submittedAt,
        status: SubmissionStatus.APPROVED,
        score: params.correct / params.questions.length,
        earnedPoints: params.correct,
        maxPoints: params.questions.length,
      },
    });
  };

  // 8.A — průměr 73 %, starší týden 64 % → poslední 79 % (viditelný růst),
  // Jakub Starý 43 % (LOW_AVERAGE → riziko), Petr Zeman 57 % (druhý rizikový),
  // poslední dva žáci bez odevzdání (NO_DATA). Hrdina (zak8a) 6/7 ≈ 86 %.
  // Pozor: >14 dní bez aktivity = INACTIVE flag — všechna odevzdání proto
  // drží v posledních 13 dnech, riziko nesou jen skóre pod 60 %.
  const plan8A: { correct: number; day: number }[] = [
    { correct: 6, day: 3 }, // Ondřej Sýkora — hrdina, „hotový test s 86 %"
    { correct: 5, day: 13 },
    { correct: 5, day: 12 },
    { correct: 7, day: 2 },
    { correct: 3, day: 5 }, // Jakub Starý — rizikový žák č. 1 (43 %)
    { correct: 5, day: 11 },
    { correct: 4, day: 6 }, // Petr Zeman — rizikový žák č. 2 (57 %)
    { correct: 6, day: 4 },
    { correct: 5, day: 9 },
    { correct: 6, day: 7 },
  ];
  for (const [i, s] of students8A.entries()) {
    const step = plan8A[i];
    if (!step) continue; // poslední dva neodevzdali
    await submitScripted({
      assignmentId: assignment8A.id,
      testId: testZlomky.id,
      questions: questionsZlomky,
      membershipId: s.membershipId,
      correct: step.correct,
      day: step.day,
    });
  }

  // Výsledky i pro 5.A (homeroom učitele — default pohled ve Výsledcích)
  const assignment5A = await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: testVyjmenovana.id,
      targetType: 'CLASS',
      classSectionId: class5A.id,
      openAt: daysAgo(14, 8),
      closeAt: daysAgo(1, 18),
      maxAttempts: 2,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher1.membershipId,
    },
  });
  const questionsVyjm = await prisma.question.findMany({
    where: { testId: testVyjmenovana.id },
    orderBy: { order: 'asc' },
  });
  // 5.A (homeroom učitele — default pohled) — průměr 83 %, bez rizikových,
  // jeden žák zatím bez odevzdání.
  const plan5A: { correct: number; day: number }[] = [
    { correct: 3, day: 12 },
    { correct: 3, day: 10 },
    { correct: 3, day: 9 },
    { correct: 4, day: 7 },
    { correct: 3, day: 6 },
    { correct: 4, day: 4 },
    { correct: 3, day: 3 },
    { correct: 4, day: 2 },
    { correct: 3, day: 1 },
  ];
  for (const [i, s5] of students5A.entries()) {
    const step = plan5A[i];
    if (!step) continue; // jeden neodevzdal
    await submitScripted({
      assignmentId: assignment5A.id,
      testId: testVyjmenovana.id,
      questions: questionsVyjm,
      membershipId: s5.membershipId,
      correct: step.correct,
      day: step.day,
    });
  }

  // Otevřené zadání pro old-test screenshot (časovač): zak8a má co vyplňovat.
  // Vlastní test — Zlomky už má hrdina „hotové", stejný název v Čeká i Hotovo
  // by na dashboardu vypadal jako chyba.
  const testRovnice = await mkTest({
    title: 'Rovnice o jedné neznámé',
    description: 'Procvičení jednoduchých rovnic před písemkou.',
    subjectId: catalog.math.subject.id,
    topicLevelId: catalog.math.topicLevels[`${SchoolGrade.GRADE_8}:Rovnice`]!,
    grades: [SchoolGrade.GRADE_8],
    status: PublishStatus.PUBLISHED,
    creatorId: teacher1.membershipId,
    createdDaysAgo: 4,
    questions: [
      { text: 'Kolik je x, když x + 7 = 15?', type: MC, correctAnswer: '8', options: ['8', '7', '9'] },
      { text: 'Rovnice 2x = 10 má řešení x = 5.', type: TF, correctAnswer: 'true' },
      { text: 'Kolik je x, když 3x − 4 = 11?', type: MC, correctAnswer: '5', options: ['5', '4', '6'] },
      { text: 'Rovnice x/2 = 6 má řešení x = 3.', type: TF, correctAnswer: 'false' },
      { text: 'Kolik je x, když 4x = 2x + 12?', type: MC, correctAnswer: '6', options: ['6', '12', '3'] },
    ],
  });
  await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: testRovnice.id,
      targetType: 'STUDENTS',
      openAt: daysAgo(1, 7),
      closeAt: daysAgo(-14, 18), // +14 dní
      maxAttempts: 3,
      timeLimitSec: 15 * 60,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher1.membershipId,
      students: { create: { studentId: students8A[0]!.membershipId } },
    },
  });
  // Young test pro 2.B (dlaždice)
  await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: testVyjmenovana.id,
      targetType: 'CLASS',
      classSectionId: class2B.id,
      openAt: daysAgo(1, 7),
      closeAt: daysAgo(-14, 18),
      maxAttempts: 3,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher1.membershipId,
    },
  });
  // Druhé young zadání — portfolio skript potřebuje startovatelný test
  // pro 2.B dvakrát (desktop dlaždice + mobilní flow) v jednom běhu.
  await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: testVyjmenovana.id,
      targetType: 'CLASS',
      classSectionId: class2B.id,
      openAt: daysAgo(0, 7),
      closeAt: daysAgo(-21, 18),
      maxAttempts: 3,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher1.membershipId,
    },
  });
  // G2 zadání (ať G2 dashboard není prázdný) — otevřené už 10 dní, většina
  // třídy odevzdala (průměr 83 %), zakg2 má test teprve před sebou.
  const assignmentG2 = await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: testModerna.id,
      targetType: 'CLASS',
      classSectionId: classG2.id,
      openAt: daysAgo(10, 7),
      closeAt: daysAgo(-14, 18),
      maxAttempts: 2,
      timeLimitSec: 10 * 60,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher1.membershipId,
    },
  });
  const questionsModerna = await prisma.question.findMany({
    where: { testId: testModerna.id },
    orderBy: { order: 'asc' },
  });
  const planG2: ({ correct: number; day: number } | null)[] = [
    null, // Alžběta Konečná (zakg2) — test ji teprve čeká
    { correct: 3, day: 8 },
    { correct: 3, day: 6 },
    { correct: 4, day: 5 },
    { correct: 3, day: 4 },
    { correct: 3, day: 2 },
    { correct: 4, day: 1 },
    null, // jeden student zatím bez odevzdání
  ];
  for (const [i, sg] of studentsG2.entries()) {
    const step = planG2[i];
    if (!step) continue;
    await submitScripted({
      assignmentId: assignmentG2.id,
      testId: testModerna.id,
      questions: questionsModerna,
      membershipId: sg.membershipId,
      correct: step.correct,
      day: step.day,
    });
  }
  // Druhé čekající zadání pro 8.A — „Procenta kolem nás" bez časového limitu
  // (na kartě se ukáže „Konec za 18 dní" místo odpočtu).
  await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: testProcenta.id,
      targetType: 'CLASS',
      classSectionId: class8A.id,
      openAt: daysAgo(0, 7),
      closeAt: daysAgo(-18, 18),
      maxAttempts: 2,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher1.membershipId,
    },
  });

  // -------------------------------------------------------------------------
  logStep('XP historie žáka (zak8a) — poslední 3 týdny…');
  // Levels jsou globální tabulka — bez ní dashboard hlásí „nejvyšší úroveň"
  await prisma.level.createMany({
    data: [
      { levelNo: 1, minXp: 0 },
      { levelNo: 2, minXp: 50 },
      { levelNo: 3, minXp: 150 },
      { levelNo: 4, minXp: 350 },
      { levelNo: 5, minXp: 750 },
      { levelNo: 6, minXp: 1500 },
      { levelNo: 7, minXp: 3000 },
      { levelNo: 8, minXp: 5000 },
      { levelNo: 9, minXp: 8000 },
      { levelNo: 10, minXp: 12000 },
    ],
    skipDuplicates: true,
  });
  const hero = students8A[0]!;
  // Streak přesně 6: přihlášení dny 0–5, mezera v den 6, další blok 7–11.
  const loginDays = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
  for (const day of loginDays) {
    await prisma.xpEvent.create({
      data: {
        membershipId: hero.membershipId,
        type: $Enums.XpEventType.LOGIN,
        value: 5,
        description: 'Denní přihlášení',
        createdAt: daysAgo(day, 7, 45),
      },
    });
  }
  const testXpDays = [16, 8, 3]; // den 3 = odevzdání Zlomků (viz plan8A)
  for (const day of testXpDays) {
    await prisma.xpEvent.create({
      data: {
        membershipId: hero.membershipId,
        type: $Enums.XpEventType.TEST_COMPLETION,
        value: 40,
        description: 'Dokončený test',
        createdAt: daysAgo(day, 14, 10),
      },
    });
  }

  // Denormalizovaný součet na membership — profil čte membership.xp/level.
  // 175 XP → level 3 a progress bar přesně v půlce (175/350).
  const heroXp = loginDays.length * 5 + testXpDays.length * 40;
  await prisma.membership.update({
    where: { id: hero.membershipId },
    data: { xp: heroXp, level: 3 },
  });

  // -------------------------------------------------------------------------
  logStep('Kampaně: Výprava 4/8 (2.B) + Archiv 1/3 (8.A)…');
  const expedition = await prisma.campaignProgress.create({
    data: {
      organizationId: org.id,
      classSectionId: class2B.id,
      campaignId: 'vyprava-svetluska',
      campaignType: CampaignType.EXPEDITION,
      status: CampaignProgressStatus.ACTIVE,
      position: 4,
      totalSteps: 8,
      startedAt: daysAgo(18),
    },
  });
  const expeditionSteps = [
    { i: 1, key: 'rozkvetla-louka', rounds: 4, day: 16 },
    { i: 2, key: 'bublavy-potok', rounds: 3, day: 12 },
    { i: 3, key: 'jahodova-stran', rounds: 5, day: 8 },
    { i: 4, key: 'vetrny-mlyn', rounds: 4, day: 3 },
  ];
  for (const s of expeditionSteps) {
    await prisma.campaignStepUnlock.create({
      data: {
        progressId: expedition.id,
        stepIndex: s.i,
        stepKey: s.key,
        roundsPlayed: s.rounds,
        unlockedAt: daysAgo(s.day, 10, 30),
      },
    });
  }
  // Třídní parťák 2.B — XP odpovídá odehraným bleskovkám (10/kolo + 50/finish)
  const partak2BXp = expeditionSteps.reduce((sum, s) => sum + s.rounds * 10 + 50, 0);
  const partak2B = await prisma.classPartak.create({
    data: {
      organizationId: org.id,
      classSectionId: class2B.id,
      xp: partak2BXp,
      stage: 1 + Math.floor(partak2BXp / 300),
    },
  });
  for (const s of expeditionSteps) {
    await prisma.classPartakXpEvent.createMany({
      data: [
        { classPartakId: partak2B.id, type: 'ROUND_PLAYED', value: s.rounds * 10, createdAt: daysAgo(s.day, 10, 30) },
        { classPartakId: partak2B.id, type: 'SESSION_FINISHED', value: 50, createdAt: daysAgo(s.day, 10, 31) },
      ],
    });
  }

  // Archiv: loňská G2 třída ho dokončila a nechala vzkaz → 8.A ho má zapečetěný
  const predecessorClass = await prisma.classSection.create({
    data: {
      orgId: org.id,
      yearId: year.id,
      grade: SchoolGrade.GRADE_9,
      section: 'A',
      label: '9.A (loňská)',
    },
  });
  const predecessor = await prisma.campaignProgress.create({
    data: {
      organizationId: org.id,
      classSectionId: predecessorClass.id,
      campaignId: 'mise-archiv',
      campaignType: CampaignType.MISSION,
      status: CampaignProgressStatus.COMPLETED,
      position: 3,
      totalSteps: 3,
      startedAt: daysAgo(120),
      completedAt: daysAgo(60),
      epilogueMessage:
        'Jestli tohle čtete, archiv pořád funguje. Nebojte se ptát na věci, na které se nikdo neptá — přesně tak jsme ho našli my. Hodně štěstí, ať se signál nikdy neztratí. — vaše loňská 9.A',
      epilogueSubmittedAt: daysAgo(58),
    },
  });
  for (const [i, key] of ['signal', 'sum', 'klic'].entries()) {
    await prisma.campaignStepUnlock.create({
      data: {
        progressId: predecessor.id,
        stepIndex: i + 1,
        stepKey: key,
        roundsPlayed: 5,
        unlockedAt: daysAgo(100 - i * 15),
      },
    });
  }

  const mission = await prisma.campaignProgress.create({
    data: {
      organizationId: org.id,
      classSectionId: class8A.id,
      campaignId: 'mise-archiv',
      campaignType: CampaignType.MISSION,
      status: CampaignProgressStatus.ACTIVE,
      position: 1,
      totalSteps: 3,
      startedAt: daysAgo(7),
      predecessorProgressId: predecessor.id,
    },
  });
  await prisma.campaignStepUnlock.create({
    data: {
      progressId: mission.id,
      stepIndex: 1,
      stepKey: 'signal',
      roundsPlayed: 6,
      unlockedAt: daysAgo(4, 11, 15),
    },
  });
  const partak8A = await prisma.classPartak.create({
    data: { organizationId: org.id, classSectionId: class8A.id, xp: 110, stage: 1 },
  });
  await prisma.classPartakXpEvent.createMany({
    data: [
      { classPartakId: partak8A.id, type: 'ROUND_PLAYED', value: 60, createdAt: daysAgo(4, 11, 15) },
      { classPartakId: partak8A.id, type: 'SESSION_FINISHED', value: 50, createdAt: daysAgo(4, 11, 16) },
    ],
  });

  // -------------------------------------------------------------------------
  logStep('Knihovna — pár materiálů, ať není prázdná…');
  const materials = [
    { title: 'Zlomky — pracovní list', type: ContentType.MATERIAL, level: EducationLevel.PRIMARY_2, grade: SchoolGrade.GRADE_8, subjectId: catalog.math.subject.id },
    { title: 'Vyjmenovaná slova — pexeso k vytištění', type: ContentType.PRACTICE, level: EducationLevel.PRIMARY_1, grade: SchoolGrade.GRADE_2, subjectId: catalog.czech.subject.id },
    { title: 'Literární moderna — přehledová mapa', type: ContentType.MATERIAL, level: EducationLevel.SECONDARY_MATURITA, grade: SchoolGrade.HIGH_SCHOOL_YEAR_2, subjectId: catalog.lit.subject.id },
  ];
  for (const m of materials) {
    await prisma.learningMaterial.create({
      data: {
        title: m.title,
        description: 'Ukázkový materiál pro showcase prostředí.',
        contentType: m.type,
        educationLevel: m.level,
        schoolGrade: m.grade,
        subjectId: m.subjectId,
        scope: ContentScope.ORGANIZATION,
        organizationId: org.id,
        createdById: teacher1.membershipId,
        accessLevel: 'FREE',
      },
    });
  }

  logDone('Showcase seed hotov.');
  console.log(`Organizace: ${ORG_NAME}`);
  console.log(`Ředitelka:  reditel@${DOMAIN} (Jana Květová)`);
  console.log(`Učitel:     ucitel@${DOMAIN} (Petr Jasan — 5.A + úvazky 2.B/8.A/G2)`);
  console.log(`Žákyně 2.B: zak2b@${DOMAIN} (Anička Malá — young)`);
  console.log(`Žák 8.A:    zak8a@${DOMAIN} (Ondřej Sýkora — old, XP historie)`);
  console.log(`Studentka G2: zakg2@${DOMAIN} (Alžběta Konečná)`);
  console.log(`Heslo všude: ${PASSWORD}`);
  console.log(`Výprava 2.B: 4/8 zastávek · Archiv 8.A: 1/3 + zapečetěný vzkaz 9.A`);
  console.log(
    `Scénografie: 8.A ø73 % (rizikoví: Jakub Starý 43 %, Petr Zeman 57 %), ` +
      `5.A ø83 %, G2 ø83 %; zak8a: streak 6, 175 XP (level 3 v půlce), ` +
      `2 čekající testy + Zlomky hotové na 86 %.`,
  );
  console.log(`Používám ${students2B.length + NAMES_5A.length + students8A.length + studentsG2.length} žáků.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
