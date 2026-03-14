import { PrismaClient, SchoolGrade, TopicPhase } from '@prisma/client';
import {
  CATALOG_SUBJECT_IDS,
  CATALOG_TOPIC_IDS,
  ORG_IDS,
  USER_EMAILS,
} from './seed-constants';
import { logDone, logStep } from './seed-helpers';

const CATALOG_SUBJECTS = [
  {
    id: CATALOG_SUBJECT_IDS.math,
    code: 'MATH_SKILLSTORM',
    name: 'Matematika',
    gradeFrom: 1,
    gradeTo: 9,
    topics: [
      { id: CATALOG_TOPIC_IDS.mathFractions, name: 'Zlomky' },
      { id: CATALOG_TOPIC_IDS.mathGeometry, name: 'Geometrie' },
    ],
  },
  {
    id: CATALOG_SUBJECT_IDS.english,
    code: 'ENG_SKILLSTORM',
    name: 'Anglický jazyk',
    gradeFrom: 1,
    gradeTo: 9,
    topics: [
      { id: CATALOG_TOPIC_IDS.englishVocabulary, name: 'Slovní zásoba' },
      { id: CATALOG_TOPIC_IDS.englishGrammar, name: 'Gramatika' },
    ],
  },
  {
    id: CATALOG_SUBJECT_IDS.informatics,
    code: 'IT_SKILLSTORM',
    name: 'Informatika',
    gradeFrom: 1,
    gradeTo: 9,
    topics: [
      { id: CATALOG_TOPIC_IDS.itAlgorithms, name: 'Algoritmy' },
      { id: CATALOG_TOPIC_IDS.itSecurity, name: 'Bezpečnost' },
    ],
  },
];

const DEFAULT_SUBJECTS = [
  { name: 'Matematika', gradeFrom: 1, gradeTo: 9 },
  { name: 'Český jazyk', gradeFrom: 1, gradeTo: 9 },
  { name: 'Anglický jazyk', gradeFrom: 1, gradeTo: 9 },
  { name: 'Prvouka', gradeFrom: 1, gradeTo: 3 },
  { name: 'Přírodověda', gradeFrom: 4, gradeTo: 5 },
  { name: 'Vlastivěda', gradeFrom: 4, gradeTo: 5 },
  { name: 'Přírodopis', gradeFrom: 6, gradeTo: 9 },
  { name: 'Fyzika', gradeFrom: 6, gradeTo: 9 },
  { name: 'Chemie', gradeFrom: 8, gradeTo: 9 },
  { name: 'Dějepis', gradeFrom: 6, gradeTo: 9 },
  { name: 'Zeměpis', gradeFrom: 6, gradeTo: 9 },
  { name: 'Informatika', gradeFrom: 1, gradeTo: 9 },
] as const;

export async function seed(prisma: PrismaClient) {
  logStep('Subjects > catalog & local subjects');
  const grades = Object.values(SchoolGrade);

  // === 1️⃣ Katalogové předměty + témata ===
  for (const subject of CATALOG_SUBJECTS) {
    let created;

    try {
      created = await prisma.catalogSubject.upsert({
        where: { code: subject.code },
        update: { name: subject.name },
        create: {
          id: subject.id,
          code: subject.code,
          name: subject.name,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        created = await prisma.catalogSubject.findUnique({
          where: { code: subject.code },
        });
        console.warn(
          `⚠️ Subjects > CatalogSubject "${subject.code}" already exists, skipping creation.`,
        );
      } else {
        throw err;
      }
    }

    if (!created) continue;

    // === Témata ===
    for (const topic of subject.topics) {
      const existingTopic = await prisma.catalogTopic.findFirst({
        where: { subjectId: created.id, name: topic.name },
      });

      if (existingTopic) {
        await prisma.catalogTopic.update({
          where: { id: existingTopic.id },
          data: { name: topic.name },
        });
        console.log(
          `ℹ️ Subjects > CatalogTopic '${topic.name}' already exists for ${subject.name}, updated name if needed.`,
        );
        continue;
      }

      try {
        await prisma.catalogTopic.create({
          data: {
            id: topic.id,
            subjectId: created.id,
            name: topic.name,
          },
        });
        console.log(`✅ Subjects > Created topic '${topic.name}' for ${subject.name}`);
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.warn(
            `⚠️ Subjects > CatalogTopic '${topic.name}' already exists, skipping.`,
          );
        } else {
          throw err;
        }
      }
    }
  }

  const organizations = await prisma.organization.findMany({
    where: { id: { in: Object.values(ORG_IDS) } },
    select: { id: true },
  });

  for (const subject of CATALOG_SUBJECTS) {
    const subjectRecord = await prisma.subject.upsert({
      where: { catalogSubjectId: subject.id },
      update: {
        name: subject.name,
        gradeFrom: subject.gradeFrom,
        gradeTo: subject.gradeTo,
      },
      create: {
        catalogSubjectId: subject.id,
        name: subject.name,
        gradeFrom: subject.gradeFrom,
        gradeTo: subject.gradeTo,
      },
    });

    for (const grade of grades) {
      const subjectLevel = await prisma.subjectLevel.upsert({
        where: {
          subjectId_grade: {
            subjectId: subjectRecord.id,
            grade,
          },
        },
        update: { label: `${subject.name} ${grade}` },
        create: {
          subjectId: subjectRecord.id,
          grade,
          order: null,
          label: `${subject.name} ${grade}`,
        },
      });

      for (const topic of subject.topics) {
        await prisma.topicLevel.upsert({
          where: {
            subjectLevelId_catalogTopicId_phase: {
              subjectLevelId: subjectLevel.id,
              catalogTopicId: topic.id,
              phase: TopicPhase.INTRO,
            },
          },
          update: { name: topic.name },
          create: {
            subjectLevelId: subjectLevel.id,
            catalogTopicId: topic.id,
            name: topic.name,
            order: 1,
            phase: TopicPhase.INTRO,
          },
        });
      }
    }

    for (const org of organizations) {
      await prisma.orgSubject.upsert({
        where: {
          organizationId_subjectId: {
            organizationId: org.id,
            subjectId: subjectRecord.id,
          },
        },
        update: { isEnabled: true },
        create: {
          organizationId: org.id,
          subjectId: subjectRecord.id,
          isEnabled: true,
          isCustom: false,
        },
      });
    }

    const teacher = await prisma.teacher.findFirst({
      where: {
        membership: {
          user: { email: USER_EMAILS.teacher },
          organizationId: ORG_IDS.chodovicka,
        },
      },
      select: { id: true },
    });

    if (teacher) {
      const existingLink = await prisma.teacherSubject.findUnique({
        where: {
          teacherId_subjectId: {
            teacherId: teacher.id,
            subjectId: subjectRecord.id,
          },
        },
      });
      if (!existingLink) {
        try {
          await prisma.teacherSubject.create({
            data: {
              teacherId: teacher.id,
              subjectId: subjectRecord.id,
            },
          });
        } catch (err: any) {
          if (err.code !== 'P2002') throw err;
        }
      }
    }
  }

  await prisma.subject.createMany({
    data: DEFAULT_SUBJECTS.map((item) => ({
      name: item.name,
      gradeFrom: item.gradeFrom,
      gradeTo: item.gradeTo,
    })),
    skipDuplicates: true,
  });

  logDone('Subjects & catalog data ready');
}
