import { BadRequestException } from '@nestjs/common';
import {
  LessonStageCompletionType,
  LessonStageType,
} from '@prisma/client';
import { z } from 'zod';
import {
  accessibilityPlanSchema,
  assetManifestSchema,
  dataPolicySchema,
  hardwareRequirementsSchema,
  offlinePolicySchema,
} from '@/activity-engine/activity-metadata.schemas';
import type { CreateLessonExperienceVersionDto } from './dto/lesson-experience.dto';

const teacherPlanSchema = z
  .object({
    startInstructions: z.string().trim().min(1).max(2000),
    fallbackStrategy: z.string().trim().min(1).max(2000),
    discussionPrompts: z.array(z.string().trim().min(1).max(1000)).max(20),
    interventionPoints: z
      .array(
        z
          .object({
            stageKey: z.string().trim().min(1).max(120),
            reason: z.string().trim().min(1).max(1000),
            action: z.string().trim().min(1).max(1500),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

function parseOrThrow<T>(label: string, schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'LESSON_PUBLICATION_METADATA_INVALID',
      section: label,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

export function validateLessonDefinition(input: CreateLessonExperienceVersionDto) {
  const supportedModes = [...new Set(input.supportedModes)];
  if (supportedModes.length === 0 || !supportedModes.includes(input.recommendedMode)) {
    throw new BadRequestException({ code: 'LESSON_RECOMMENDED_MODE_UNSUPPORTED' });
  }
  if (input.stages.length < 2 || input.stages.length > 24) {
    throw new BadRequestException({ code: 'LESSON_STAGE_COUNT_INVALID' });
  }

  const ordered = [...input.stages].sort((a, b) => a.orderIndex - b.orderIndex);
  const keys = new Set<string>();
  let duration = 0;
  let hasInteractiveStage = false;
  let hasEvidence = false;
  let hasReflection = false;
  let hasLearnerAction = false;

  for (let index = 0; index < ordered.length; index += 1) {
    const stage = ordered[index]!;
    if (stage.orderIndex !== index) {
      throw new BadRequestException({
        code: 'LESSON_STAGE_ORDER_NOT_CONTIGUOUS',
        expected: index,
        actual: stage.orderIndex,
      });
    }
    if (keys.has(stage.stageKey)) {
      throw new BadRequestException({ code: 'LESSON_STAGE_KEY_DUPLICATE', stageKey: stage.stageKey });
    }
    keys.add(stage.stageKey);
    duration += stage.durationMin;

    if (
      stage.completionType === LessonStageCompletionType.ACTIVITY &&
      !stage.activityVersionId
    ) {
      throw new BadRequestException({
        code: 'LESSON_ACTIVITY_COMPLETION_REQUIRES_ACTIVITY',
        stageKey: stage.stageKey,
      });
    }
    if (
      stage.completionType === LessonStageCompletionType.CHECKPOINT &&
      !stage.checkpoint
    ) {
      throw new BadRequestException({
        code: 'LESSON_CHECKPOINT_COMPLETION_REQUIRES_CHECKPOINT',
        stageKey: stage.stageKey,
      });
    }
    if (
      stage.stageType === LessonStageType.TEACHER_INTERVENTION &&
      !stage.teacherIntervention
    ) {
      throw new BadRequestException({
        code: 'LESSON_TEACHER_INTERVENTION_FLAG_REQUIRED',
        stageKey: stage.stageKey,
      });
    }

    hasInteractiveStage ||= Boolean(stage.activityVersionId);
    hasEvidence ||= stage.stageType === LessonStageType.EVIDENCE;
    hasReflection ||= stage.stageType === LessonStageType.REFLECTION;
    hasLearnerAction ||= [
      LessonStageType.PREDICTION,
      LessonStageType.EXPLORATION,
      LessonStageType.CHALLENGE,
    ].includes(stage.stageType);
  }

  if (duration > input.estimatedDurationMin) {
    throw new BadRequestException({
      code: 'LESSON_STAGE_DURATION_EXCEEDS_ESTIMATE',
      stageDurationMin: duration,
      estimatedDurationMin: input.estimatedDurationMin,
    });
  }
  if (!hasInteractiveStage) {
    throw new BadRequestException({ code: 'LESSON_INTERACTIVE_STAGE_REQUIRED' });
  }
  if (!hasLearnerAction) {
    throw new BadRequestException({ code: 'LESSON_LEARNER_ACTION_REQUIRED' });
  }
  if (!hasReflection || !hasEvidence) {
    throw new BadRequestException({
      code: 'LESSON_REFLECTION_AND_EVIDENCE_REQUIRED',
      hasReflection,
      hasEvidence,
    });
  }

  const teacherPlan = parseOrThrow('teacherPlan', teacherPlanSchema, input.teacherPlan);
  const hardware = parseOrThrow(
    'hardwareRequirements',
    hardwareRequirementsSchema,
    input.hardwareRequirements,
  );
  const accessibility = parseOrThrow(
    'accessibilityPlan',
    accessibilityPlanSchema,
    input.accessibilityPlan,
  );
  const dataPolicy = parseOrThrow('privacyPlan', dataPolicySchema, input.privacyPlan);
  const offline = parseOrThrow('offlinePolicy', offlinePolicySchema, input.offlinePolicy);
  const assets = parseOrThrow('assetManifest', assetManifestSchema, input.assetManifest);

  for (const point of teacherPlan.interventionPoints) {
    if (!keys.has(point.stageKey)) {
      throw new BadRequestException({
        code: 'LESSON_INTERVENTION_STAGE_UNKNOWN',
        stageKey: point.stageKey,
      });
    }
  }
  if (!accessibility.keyboardPath || !accessibility.touchPath || !accessibility.nonColorCues) {
    throw new BadRequestException({ code: 'LESSON_ACCESSIBILITY_BASELINE_INCOMPLETE' });
  }
  if (dataPolicy.rawMediaStorage) {
    throw new BadRequestException({ code: 'LESSON_RAW_MEDIA_REQUIRES_SEPARATE_REVIEW' });
  }
  if (offline.reconnectable && !offline.deduplicatesByEventId) {
    throw new BadRequestException({ code: 'LESSON_RECONNECT_IDEMPOTENCY_REQUIRED' });
  }
  if (assets.assets.some((asset) => !asset.commercialUse)) {
    throw new BadRequestException({ code: 'LESSON_ASSET_COMMERCIAL_RIGHTS_REQUIRED' });
  }

  return {
    orderedStages: ordered,
    supportedModes,
    totalStageDurationMin: duration,
    teacherPlan,
    hardware,
    accessibility,
    dataPolicy,
    offline,
    assets,
  };
}
