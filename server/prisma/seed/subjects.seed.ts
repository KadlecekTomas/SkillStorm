import {
  PrismaClient,
  SchoolGrade,
  TopicPhase,
} from '@prisma/client';
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
    topics: [
      { id: CATALOG_TOPIC_IDS.mathFractions, name: 'Zlomky' },
      { id: CATALOG_TOPIC_IDS.mathGeometry, name: 'Geometrie' },
    ],
  },
  {
    id: CATALOG_SUBJECT_IDS.english,
    code: 'ENG_SKILLSTORM',
    name: 'Angličtina',
    topics: [
      { id: CATALOG_TOPIC_IDS.englishVocabulary, name: 'Slovní zásoba' },
      { id: CATALOG_TOPIC_IDS.englishGrammar, name: 'Gramatika' },
    ],
  },
  {
    id: CATALOG_SUBJECT_IDS.informatics,
    code: 'IT_SKILLSTORM',
    name: 'Informatika',
    topics: [
      { id: CATALOG_TOPIC_IDS.itAlgorithms, name: 'Algoritmy' },
      { id: CATALOG_TOPIC_IDS.itSecurity, name: 'Bezpečnost' },
    ],
  },
];

export async function seed(prisma: PrismaClient) {
  logStep('Subjects > catalog & local subjects');

  // === 1) Katalogové předměty + témata ===
  for (const subject of CATALOG_SUBJECTS) {
    const created = await prisma.catalogSubject.upsert({
      where: { id: subject.id },
      update: { name: subject.name, code: subject.code },
      create: { id: subject.id, code: subject.code, name: subject.name },
    });

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
          `ℹ️ Subjects > CatalogTopic '${topic.name}' already exists for ${subject.name}, updating name if needed.`,
        );
        continue;
      }

      try {
        await prisma.catalogTopic.create({
          data: { id: topic.id, subjectId: created.id, name: topic.name },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const fallback = await prisma.catalogTopic.findFirst({
            where: { subjectId: created.id, name: topic.name },
          });
          if (fallback) {
            console.log(
              `⚠️ Subjects > CatalogTopic '${topic.name}' hit P2002 but exists already, skipping create.`,
            );
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
  }

  // === 2) Všechny organizace ===
  const organizations = await prisma.organization.findMany({
    where: { id: { in: Object.values(ORG_IDS) } },
    select: { id: true },
  });

  for (const org of organizations) {
    for (const subject of CATALOG_SUBJECTS) {
      const subjectRecord = await prisma.subject.upsert({
        where: {
          organizationId_catalogSubjectId: {
            organizationId: org.id,
            catalogSubjectId: subject.id,
          },
        },
        update: { name: subject.name },
        create: {
          organizationId: org.id,
          catalogSubjectId: subject.id,
          name: subject.name,
        },
      });

      const subjectLevel = await prisma.subjectLevel.upsert({
        where: {
          subjectId_grade: {
            subjectId: subjectRecord.id,
            grade: SchoolGrade.GRADE_6,
          },
        },
        update: { label: `${subject.name} 6. ročník` },
        create: {
          subjectId: subjectRecord.id,
          grade: SchoolGrade.GRADE_6,
          order: 1,
          label: `${subject.name} 6. ročník`,
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

      // === 3) Vazba učitel <-> předmět (jen Chodovická) ===
      if (org.id === ORG_IDS.chodovicka) {
        const teacher = await prisma.teacher.findFirst({
          where: {
            membership: {
              user: { email: USER_EMAILS.teacher },
              organizationId: ORG_IDS.chodovicka,
            },
          },
          select: { id: true },
        });

        if (!teacher) {
          console.log(
            '⚠️ Subjects > Teacher not found for teacher@chodovicka.cz – skipping link.',
          );
          continue;
        }

        const linkKey = {
          teacherId_subjectId: {
            teacherId: teacher.id,
            subjectId: subjectRecord.id,
          },
        };

        try {
          const existing = await prisma.teacherSubject.findUnique({
            where: linkKey,
          });

          if (existing) {
            console.log(
              `ℹ️ Subjects > Teacher already linked to ${subjectRecord.name}`,
            );
          } else {
            await prisma.teacherSubject.create({
              data: {
                teacherId: teacher.id,
                subjectId: subjectRecord.id,
              },
            });
            console.log(
              `✅ Subjects > Linked teacher ${teacher.id} to ${subjectRecord.name}`,
            );
          }
        } catch (err: any) {
          if (err.code === 'P2002') {
            console.log(
              `⚠️ Subjects > Duplicate link detected for ${subjectRecord.name}, skipping.`,
            );
          } else {
            console.error(
              `❌ Subjects > Unexpected error linking teacher to ${subjectRecord.name}:`,
              err,
            );
          }
        }
      }
    }
  }

  logDone('Subjects & catalog data ready');
}
