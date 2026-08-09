import {
  ActivityCurriculumMappingStatus,
  ActivityCurriculumMappingType,
  ActivityDeliveryMode,
  LessonExperienceCurriculumMappingType,
  LessonStageCompletionType,
  LessonStageType,
  MappingProposerType,
  OrganizationRole,
  SystemRole,
} from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { CreateActivityVersionDto } from '@/activity-engine/dto/activity.dto';
import type { ActivityService } from '@/activity-engine/activity.service';
import type { CurriculumService } from '@/curriculum/curriculum.service';
import type {
  CreateLessonExperienceVersionDto,
  ProposeLessonCurriculumMappingDto,
} from '@/lesson-experience/dto/lesson-experience.dto';

export function lessonSchoolActor(ctx: any): JwtPayload {
  return {
    userId: ctx.owner.user.id,
    email: ctx.owner.user.email,
    organizationId: ctx.organization.id,
    membershipId: ctx.owner.membership.id,
    organizationRole: OrganizationRole.DIRECTOR,
    activeRole: OrganizationRole.DIRECTOR,
  };
}

export function lessonPlatformActor(ctx: any): JwtPayload {
  return {
    userId: ctx.owner.user.id,
    email: ctx.owner.user.email,
    systemRole: SystemRole.SUPERADMIN,
    isPlatformAdmin: true,
  };
}

export function lessonActivityVersionInput(
  title = 'Lesson fixture Activity',
): CreateActivityVersionDto {
  return {
    engineKey: 'CORE_INTERACTION_V1',
    schemaVersion: 1,
    title,
    supportedModes: [ActivityDeliveryMode.BOARD_ONLY],
    recommendedMode: ActivityDeliveryMode.BOARD_ONLY,
    interactionPrimitives: ['PREDICT', 'CHECKPOINT', 'REFLECT'],
    config: {
      kind: 'PREDICT',
      prompt: 'Jaký model bys zvolil a proč?',
      content: {},
    },
    capabilityRequirements: { required: ['SEMANTIC_EVENTS'] },
    assetManifest: { assets: [] },
    accessibilityPlan: {
      keyboardPath: true,
      touchPath: true,
      reducedMotion: true,
      nonColorCues: true,
      instructionAlternative: true,
      dragAlternative: true,
    },
    hardwareRequirements: {
      minDevices: 0,
      microphone: 'NONE',
      camera: 'NONE',
      webgl: 'NONE',
      pointer: 'ANY',
    },
    modePolicy: {
      BOARD_ONLY: {
        preservesObjective: true,
        evidenceEquivalent: true,
        fallback: 'Učitel pokračuje na společné tabuli.',
      },
    },
    privacyPlan: {
      storedData: ['prediction', 'checkpoint'],
      rawMediaStorage: false,
      retentionPolicy: 'inherit-school-learning-evidence-policy',
    },
    safetyPlan: {
      riskLevel: 'LOW',
      reviewLane: 'standard-pedagogy',
      teacherGate: false,
    },
    offlinePolicy: {
      mode: 'QUEUE_EVENTS',
      reconnectable: true,
      deduplicatesByEventId: true,
      maxOfflineSeconds: 300,
      fallback: 'Pokračuj lokálně a eventy odešli po návratu sítě.',
    },
    evidencePlan: {
      completionIsMastery: false,
      signals: [
        {
          type: 'PREDICTION_SUBMITTED',
          objectiveReference: 'fixture-outcome',
          interpretation: 'Prediction evidence only.',
          rawOrDerived: 'RAW',
        },
      ],
    },
  };
}

export function lessonVersionInput(
  activityVersionId: string,
  title = 'Datová detektivka',
): CreateLessonExperienceVersionDto {
  return {
    schemaVersion: 1,
    title,
    summary: '35min lesson fixture',
    learningObjective: 'Žák vytvoří, porovná a zdůvodní datový model.',
    pedagogicalRationale:
      'Interaktivní manipulace umožní porovnat modely a jejich důsledky.',
    supportedModes: [ActivityDeliveryMode.BOARD_ONLY],
    recommendedMode: ActivityDeliveryMode.BOARD_ONLY,
    estimatedDurationMin: 35,
    teacherPlan: {
      startInstructions: 'Otevři problém bez prozrazení řešení.',
      fallbackStrategy: 'Pokračuj diskusí nad statickým schématem.',
      discussionPrompts: ['Co změnilo váš původní model?'],
      interventionPoints: [
        {
          stageKey: 'DISCUSS',
          reason: 'Porovnat dvě rozdílné strategie.',
          action: 'Zviditelni strategie anonymně a nech třídu argumentovat.',
        },
      ],
    },
    hardwareRequirements: {
      minDevices: 0,
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
      storedData: ['prediction', 'evidence'],
      rawMediaStorage: false,
      retentionPolicy: 'inherit-school-learning-evidence-policy',
    },
    offlinePolicy: {
      mode: 'QUEUE_EVENTS',
      reconnectable: true,
      deduplicatesByEventId: true,
      maxOfflineSeconds: 300,
      fallback: 'Pokračuj na tabuli a synchronizuj později.',
    },
    assetManifest: { assets: [] },
    stages: [
      {
        stageKey: 'HOOK',
        orderIndex: 0,
        stageType: LessonStageType.HOOK,
        title: 'Záhada',
        durationMin: 3,
        completionType: LessonStageCompletionType.MANUAL,
        checkpoint: false,
        required: true,
        teacherIntervention: false,
      },
      {
        stageKey: 'PREDICT',
        orderIndex: 1,
        stageType: LessonStageType.PREDICTION,
        title: 'První model',
        durationMin: 6,
        activityVersionId,
        completionType: LessonStageCompletionType.ACTIVITY,
        checkpoint: true,
        required: true,
        teacherIntervention: false,
      },
      {
        stageKey: 'DISCUSS',
        orderIndex: 2,
        stageType: LessonStageType.TEACHER_INTERVENTION,
        title: 'Porovnání strategií',
        durationMin: 5,
        completionType: LessonStageCompletionType.MANUAL,
        checkpoint: false,
        required: true,
        teacherIntervention: true,
      },
      {
        stageKey: 'CHALLENGE',
        orderIndex: 3,
        stageType: LessonStageType.CHALLENGE,
        title: 'Nová data',
        durationMin: 8,
        activityVersionId,
        completionType: LessonStageCompletionType.ACTIVITY,
        checkpoint: true,
        required: true,
        teacherIntervention: false,
      },
      {
        stageKey: 'REFLECT',
        orderIndex: 4,
        stageType: LessonStageType.REFLECTION,
        title: 'Co změnilo můj model?',
        durationMin: 5,
        completionType: LessonStageCompletionType.CHECKPOINT,
        checkpoint: true,
        required: true,
        teacherIntervention: false,
      },
      {
        stageKey: 'EVIDENCE',
        orderIndex: 5,
        stageType: LessonStageType.EVIDENCE,
        title: 'Dolož závěr',
        durationMin: 5,
        activityVersionId,
        completionType: LessonStageCompletionType.ACTIVITY,
        checkpoint: true,
        required: true,
        teacherIntervention: false,
      },
    ],
  };
}

export async function createLessonFrameworkFixture(
  curriculum: CurriculumService,
  platform: JwtPayload,
  seed: string,
) {
  const framework = await curriculum.createFramework(
    {
      code: `LESSON-${seed}`,
      jurisdiction: 'CZ',
      educationType: 'ZV',
      title: 'Lesson fixture framework',
      authorityName: 'E2E',
    },
    platform,
  );
  const release = await curriculum.importFrameworkRelease(
    framework.code,
    {
      releaseCode: `lesson-${seed}-v1`,
      title: 'Lesson fixture release',
      sourceUrl: 'https://example.invalid/lesson-e2e',
      sourceAuthority: 'E2E',
      areas: [
        {
          externalCode: 'INF',
          title: 'Informatika',
          sortOrder: 1,
          fields: [
            {
              externalCode: 'INF-DATA',
              title: 'Data',
              sortOrder: 1,
              outcomes: [
                {
                  externalCode: `INF-${seed}`,
                  title: 'Žák vytváří a interpretuje model.',
                  nodeGrade: 9,
                  aspects: [
                    {
                      code: 'MODEL',
                      title: 'Model',
                      description: 'Vytvoří a zdůvodní model.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    platform,
  );
  await curriculum.verifyFrameworkRelease(release.id, platform);
  return {
    frameworkId: framework.id,
    releaseId: release.id,
    outcomeId: release.outcomes[0]!.id,
    aspectId: release.outcomes[0]!.aspects[0]!.id,
  };
}

export async function createPublishedLessonActivity(
  activities: ActivityService,
  actor: JwtPayload,
  outcomeId: string,
  aspectId: string,
  seed: string,
) {
  const activity = await activities.createOrganizationActivity(
    { slug: `lesson-activity-${seed}`, title: 'Lesson Activity fixture' },
    actor,
  );
  const version = await activities.createVersion(
    activity.id,
    lessonActivityVersionInput(),
    actor,
  );
  const mapping = await activities.proposeMapping(
    version.id,
    {
      frameworkOutcomeId: outcomeId,
      outcomeAspectId: aspectId,
      mappingType: ActivityCurriculumMappingType.PRIMARY,
      rationale: 'Fixture Activity directly supports the mapped aspect.',
      proposedByType: MappingProposerType.HUMAN,
    },
    actor,
  );
  await activities.submitForReview(version.id, actor);
  await activities.reviewMapping(
    mapping.id,
    {
      status: ActivityCurriculumMappingStatus.APPROVED,
      rationale: 'Approved fixture Activity mapping.',
    },
    actor,
  );
  await activities.publish(version.id, actor);
  return { activityId: activity.id, activityVersionId: version.id };
}

export const lessonPrimaryMapping = (
  outcomeId: string,
  aspectId: string,
): ProposeLessonCurriculumMappingDto => ({
  frameworkOutcomeId: outcomeId,
  outcomeAspectId: aspectId,
  mappingType: LessonExperienceCurriculumMappingType.PRIMARY,
  rationale: 'Lesson provides a complete evidence path for this aspect.',
  proposedByType: MappingProposerType.HUMAN,
});
