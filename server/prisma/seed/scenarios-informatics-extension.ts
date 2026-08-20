import { Test as NestTest } from '@nestjs/testing';
import {
  ActivityCurriculumMappingStatus,
  ActivityCurriculumMappingType,
  ActivityDeliveryMode,
  LessonExperienceCurriculumMappingStatus,
  LessonStageCompletionType,
  LessonStageType,
  MappingProposerType,
  SystemRole,
} from '@prisma/client';
import { ActivityService } from '@/activity-engine/activity.service';
import { AppModule } from '@/app.module';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { LessonExperienceService } from '@/lesson-experience/lesson-experience.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  createLessonFrameworkFixture,
  lessonActivityVersionInput,
  lessonPrimaryMapping,
} from 'test/lesson-experience-fixtures';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../scripts/db-safety');

const DATABASE_URL = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
  'scenarios-informatics-extension',
);
process.env.DATABASE_URL = DATABASE_URL;

const LESSON_SLUG = 'informatika-8-algoritmy-roboticka-mise';
const ACTIVITY_SLUG = 'informatika-8-algorithm-lab';

async function main(): Promise<void> {
  const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);
  const curriculum = app.get(CurriculumService);
  const activities = app.get(ActivityService);
  const lessons = app.get(LessonExperienceService);

  try {
    const existing = await prisma.lessonExperience.findFirst({
      where: { scope: 'GLOBAL', slug: LESSON_SLUG, deletedAt: null },
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { versionNo: 'desc' },
          take: 1,
          include: { stages: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
    if (existing?.versions[0]?.stages.some((stage) => stage.activityVersionId)) {
      const activityVersionId = existing.versions[0].stages.find(
        (stage) => stage.activityVersionId,
      )?.activityVersionId;
      // eslint-disable-next-line no-console
      console.log(
        'SCENARIO_INFORMATICS_EXTENSION=' +
          JSON.stringify({
            lessonId: existing.id,
            lessonVersionId: existing.versions[0].id,
            activityVersionId,
            slug: existing.slug,
          }),
      );
      return;
    }

    const superadmin = await prisma.user.findFirst({
      where: { systemRole: SystemRole.SUPERADMIN, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!superadmin) {
      throw new Error('Scenario Informatics extension requires the SUPERADMIN fixture first.');
    }
    const platformActor: JwtPayload = {
      userId: superadmin.id,
      email: superadmin.email,
      systemRole: SystemRole.SUPERADMIN,
      isPlatformAdmin: true,
    };

    const seed = `INF8-${Date.now()}`;
    const framework = await createLessonFrameworkFixture(curriculum, platformActor, seed);

    const activity = await activities.createGlobalActivity(
      {
        slug: `${ACTIVITY_SLUG}-${Date.now().toString(36)}`,
        title: 'Algorithm Lab · Robotická mise',
        description:
          'Serverově evidovaná algoritmická aktivita: plánování programu, execution trace, debugging a spolupráce ve dvojici.',
      },
      platformActor,
    );
    const activityInput = lessonActivityVersionInput('Algorithm Lab · Robotická mise');
    activityInput.engineKey = 'ALGORITHM_LAB_V1';
    activityInput.supportedModes = [ActivityDeliveryMode.HYBRID];
    activityInput.recommendedMode = ActivityDeliveryMode.HYBRID;
    activityInput.interactionPrimitives = [
      'BUILD',
      'SIMULATE',
      'DIAGNOSE',
      'COLLABORATIVE_DECISION',
      'CHECKPOINT',
    ];
    activityInput.config = {
      kind: 'ALGORITHM_LAB',
      missionSet: 'ROBOT_GRID_V1',
      executionTrace: true,
      collaboration: 'REQUIRED',
    };
    activityInput.capabilityRequirements = {
      required: [
        'SEMANTIC_EVENTS',
        'SERVER_AUTHORITY',
        'SHARED_GROUPS',
        'INDIVIDUAL_PARTICIPANTS',
        'RECONNECTABLE',
      ],
    };
    activityInput.modePolicy = {
      HYBRID: {
        preservesObjective: true,
        evidenceEquivalent: true,
        fallback: 'Dvojice pokračuje nad jedním zařízením a po návratu spojení odešle eventy.',
      },
    };
    activityInput.evidencePlan = {
      completionIsMastery: false,
      signals: [
        {
          type: 'PROGRAM_RUN',
          objectiveReference: 'algorithm-design',
          interpretation: 'Žák skutečně otestoval sestavený algoritmus.',
          rawOrDerived: 'RAW',
        },
        {
          type: 'TEST_FAILED',
          objectiveReference: 'debugging',
          interpretation: 'Neúspěšný běh poskytuje evidence pro debugging proces.',
          rawOrDerived: 'RAW',
        },
        {
          type: 'CHECKPOINT_COMPLETED',
          objectiveReference: 'algorithm-validation',
          interpretation: 'Dokončení mise je learning evidence, nikoli automaticky mastery.',
          rawOrDerived: 'DERIVED',
        },
      ],
    };

    const activityVersion = await activities.createVersion(
      activity.id,
      activityInput,
      platformActor,
    );
    const activityMapping = await activities.proposeMapping(
      activityVersion.id,
      {
        frameworkOutcomeId: framework.outcomeId,
        outcomeAspectId: framework.aspectId,
        mappingType: ActivityCurriculumMappingType.PRIMARY,
        rationale:
          'Algorithm Lab přímo vyžaduje vytvoření, spuštění a interpretaci algoritmického modelu.',
        proposedByType: MappingProposerType.HUMAN,
      },
      platformActor,
    );
    await activities.submitForReview(activityVersion.id, platformActor);
    await activities.reviewMapping(
      activityMapping.id,
      {
        status: ActivityCurriculumMappingStatus.APPROVED,
        rationale: 'Schválená vazba algoritmické aktivity na modelování a interpretaci postupu.',
      },
      platformActor,
    );
    const publishedActivity = await activities.publish(activityVersion.id, platformActor);

    const lesson = await lessons.createGlobalLesson(
      {
        slug: LESSON_SLUG,
        title: 'Algoritmy · Robotická mise',
        description:
          'Živá hodina informatiky pro 8. ročník: žáci sestaví algoritmus, otestují ho, opraví první chybný krok a vysvětlí svoji strategii.',
      },
      platformActor,
    );

    const version = await lessons.createVersion(
      lesson.id,
      {
        schemaVersion: 1,
        title: 'Algoritmy · Robotická mise',
        summary:
          '45min interaktivní hodina pro 8.A: plánování, programování, debugging a krátká reflexe.',
        learningObjective:
          'Žák sestaví algoritmus pro řešení problému, ověří jeho průběh krok po kroku a opraví první chybný krok.',
        pedagogicalRationale:
          'Viditelný execution trace a práce ve dvojici nutí žáka formulovat postup, testovat hypotézu a opravovat konkrétní chybu místo náhodného přepisování celého řešení.',
        supportedModes: [ActivityDeliveryMode.HYBRID],
        recommendedMode: ActivityDeliveryMode.HYBRID,
        estimatedDurationMin: 45,
        teacherPlan: {
          startInstructions:
            'Spusť hodinu pro třídu, nech žáky připojit a první dvě minuty neprozrazuj řešení mise.',
          fallbackStrategy:
            'Pokud zařízení selže, dvojice zapisuje algoritmus na papír a společně projde execution trace na projekci.',
          discussionPrompts: [
            'Který první krok rozhodl o úspěchu nebo chybě?',
            'Jak bys vysvětlil opravu spolužákovi bez toho, abys mu diktoval celý program?',
          ],
          interventionPoints: [
            {
              stageKey: 'ALGORITHM_LAB',
              reason: 'Dvojice opakovaně testuje bez změny hypotézy.',
              action: 'Vyzvi je, aby označili první chybný krok a zdůvodnili jedinou změnu.',
            },
          ],
        },
        hardwareRequirements: {
          minDevices: 1,
          microphone: 'NONE',
          camera: 'NONE',
          webgl: 'NONE',
          pointer: 'ANY',
        },
        accessibilityPlan: {
          keyboardPath: true,
          touchPath: true,
          reducedMotion: true,
          nonColorCues: true,
          instructionAlternative: true,
          dragAlternative: true,
        },
        privacyPlan: {
          storedData: ['semantic-learning-events', 'derived-learning-evidence'],
          rawMediaStorage: false,
          retentionPolicy: 'inherit-school-learning-evidence-policy',
        },
        offlinePolicy: {
          mode: 'QUEUE_EVENTS',
          reconnectable: true,
          deduplicatesByEventId: true,
          maxOfflineSeconds: 300,
          fallback: 'Pokračuj v návrhu programu a po návratu připojení synchronizuj evidence.',
        },
        assetManifest: { assets: [] },
        stages: [
          {
            stageKey: 'ALGORITHM_LAB',
            orderIndex: 0,
            stageType: LessonStageType.CHALLENGE,
            title: 'Robotická mise: naplánuj, spusť, oprav',
            studentPrompt:
              'Sestav program, spusť ho krok po kroku a při chybě oprav první krok, kde se realita rozešla s tvým plánem.',
            teacherGuidance:
              'Sleduj počet běhů a neúspěchů v Mission Control. Pomáhej otázkou, ne hotovým příkazem.',
            durationMin: 35,
            activityVersionId: publishedActivity.id,
            completionType: LessonStageCompletionType.ACTIVITY,
            checkpoint: true,
            required: true,
            teacherIntervention: false,
          },
          {
            stageKey: 'REFLECT',
            orderIndex: 1,
            stageType: LessonStageType.REFLECTION,
            title: 'Co jsme změnili a proč?',
            studentPrompt:
              'Popiš jednu chybu, kterou jsi odhalil podle execution trace, a konkrétní opravu.',
            teacherGuidance:
              'Nech dvě rozdílné dvojice porovnat strategie. Completion není mastery.',
            durationMin: 8,
            completionType: LessonStageCompletionType.CHECKPOINT,
            checkpoint: true,
            required: true,
            teacherIntervention: false,
          },
        ],
      },
      platformActor,
    );

    const mapping = await lessons.proposeMapping(
      version.id,
      lessonPrimaryMapping(framework.outcomeId, framework.aspectId),
      platformActor,
    );
    await lessons.submitForReview(version.id, platformActor);
    await lessons.reviewMapping(
      mapping.id,
      {
        status: LessonExperienceCurriculumMappingStatus.APPROVED,
        rationale:
          'Robotická mise přímo vyžaduje návrh, interpretaci a zdůvodnění modelovaného postupu.',
      },
      platformActor,
    );
    const published = await lessons.publish(version.id, platformActor);

    // eslint-disable-next-line no-console
    console.log(
      'SCENARIO_INFORMATICS_EXTENSION=' +
        JSON.stringify({
          lessonId: lesson.id,
          lessonVersionId: published.id,
          activityVersionId: publishedActivity.id,
          slug: lesson.slug,
        }),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
