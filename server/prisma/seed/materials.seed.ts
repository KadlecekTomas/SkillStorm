import {
  ContentScope,
  ContentType,
  EducationLevel,
  MaterialAccessLevel,
  PrismaClient,
} from '@prisma/client';
import {
  MATERIAL_IDS,
  ORG_IDS,
  CATALOG_TOPIC_IDS,
} from './seed-constants';
import {
  getMembershipId,
  logDone,
  logStep,
  SEED_USERS,
} from './seed-helpers';

export async function seed(prisma: PrismaClient) {
  logStep('Materials > demo learning resources');

  const teacherMembershipId = await getMembershipId(
    prisma,
    SEED_USERS.teacher,
    ORG_IDS.chodovicka,
  );

  const mathTopic = await prisma.topicLevel.findFirst({
    where: {
      catalogTopicId: CATALOG_TOPIC_IDS.mathFractions,
      subjectLevel: { subject: { organizationId: ORG_IDS.chodovicka } },
    },
    select: { id: true },
  });

  const englishTopic = await prisma.topicLevel.findFirst({
    where: {
      catalogTopicId: CATALOG_TOPIC_IDS.englishVocabulary,
      subjectLevel: { subject: { organizationId: ORG_IDS.chodovicka } },
    },
    select: { id: true },
  });

  if (!mathTopic || !englishTopic) {
    throw new Error('Topic levels missing – run subjects seed first.');
  }

  await prisma.learningMaterial.upsert({
    where: { id: MATERIAL_IDS.algebraPdf },
    update: {
      title: 'Algebra Starter Kit',
      scope: ContentScope.GLOBAL,
    },
    create: {
      id: MATERIAL_IDS.algebraPdf,
      title: 'Algebra Starter Kit',
      description: 'PDF se základy zlomků a rovnic.',
      contentType: ContentType.MATERIAL,
      educationLevel: EducationLevel.SECONDARY_MATURITA,
      schoolGrade: null,
      organizationId: ORG_IDS.chodovicka,
      topicLevelId: mathTopic.id,
      createdById: teacherMembershipId,
      fileUrl:
        'https://files.skillstorm.dev/materials/algebra-starter.pdf',
      scope: ContentScope.GLOBAL,
      accessLevel: MaterialAccessLevel.FREE,
    },
  });

  await prisma.learningMaterial.upsert({
    where: { id: MATERIAL_IDS.grammarInteractive },
    update: {
      title: 'Interactive Grammar Cards',
      scope: ContentScope.ORGANIZATION,
    },
    create: {
      id: MATERIAL_IDS.grammarInteractive,
      title: 'Interactive Grammar Cards',
      description: 'Školní interaktivní cvičení na slovní zásobu a časy.',
      contentType: ContentType.MATERIAL,
      educationLevel: EducationLevel.SECONDARY_MATURITA,
      schoolGrade: null,
      organizationId: ORG_IDS.chodovicka,
      topicLevelId: englishTopic.id,
      createdById: teacherMembershipId,
      richContent: {
        type: 'flashcards',
        steps: [
          'Poslech + opakování',
          'Vyplňování vět',
          'Krátký kvíz',
        ],
      },
      scope: ContentScope.ORGANIZATION,
      accessLevel: MaterialAccessLevel.SCHOOL_ONLY,
      isDownloadable: false,
    },
  });

  logDone('Learning materials ready');
}
