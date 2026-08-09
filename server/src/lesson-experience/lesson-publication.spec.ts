import {
  ActivityDeliveryMode,
  LessonStageCompletionType,
  LessonStageType,
} from '@prisma/client';
import { validateLessonDefinition } from './lesson-publication';

function validLesson(): any {
  return {
    schemaVersion: 1,
    title: 'Datová detektivka',
    learningObjective: 'Žák vytvoří, porovná a zdůvodní datový model.',
    pedagogicalRationale: 'Interaktivní manipulace umožní porovnat více modelů a jejich důsledky.',
    supportedModes: [ActivityDeliveryMode.BOARD_ONLY],
    recommendedMode: ActivityDeliveryMode.BOARD_ONLY,
    estimatedDurationMin: 35,
    teacherPlan: {
      startInstructions: 'Otevři problém bez prozrazení řešení.',
      fallbackStrategy: 'Pokračuj diskusí nad statickým schématem.',
      discussionPrompts: ['Který model vysvětluje data nejlépe?'],
      interventionPoints: [
        {
          stageKey: 'DISCUSS',
          reason: 'Třída porovnává strategie.',
          action: 'Zviditelni dva odlišné modely bez označení jednotlivců.',
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
      fallback: 'Pokračuj na tabuli a eventy odešli po návratu sítě.',
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
        activityVersionId: '00000000-0000-4000-8000-000000000001',
        completionType: LessonStageCompletionType.ACTIVITY,
        checkpoint: true,
        required: true,
        teacherIntervention: false,
      },
      {
        stageKey: 'DISCUSS',
        orderIndex: 2,
        stageType: LessonStageType.TEACHER_INTERVENTION,
        title: 'Porovnáme strategie',
        durationMin: 6,
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
        activityVersionId: '00000000-0000-4000-8000-000000000001',
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
        title: 'Dolož svůj závěr',
        durationMin: 5,
        activityVersionId: '00000000-0000-4000-8000-000000000001',
        completionType: LessonStageCompletionType.ACTIVITY,
        checkpoint: true,
        required: true,
        teacherIntervention: false,
      },
    ],
  };
}

describe('Lesson Experience D2-B definition contract', () => {
  it('accepts a structured interactive lesson with reflection and evidence', () => {
    expect(() => validateLessonDefinition(validLesson())).not.toThrow();
  });

  it('requires contiguous deterministic stage order', () => {
    const input = validLesson();
    input.stages[2].orderIndex = 7;
    expect(() => validateLessonDefinition(input)).toThrow();
  });

  it('requires an interactive learner-action path', () => {
    const input = validLesson();
    for (const stage of input.stages) stage.activityVersionId = undefined;
    expect(() => validateLessonDefinition(input)).toThrow();
  });

  it('requires both reflection and explicit learning-evidence stages', () => {
    const input = validLesson();
    input.stages = input.stages.filter(
      (stage: any) => stage.stageType !== LessonStageType.EVIDENCE,
    );
    input.stages.forEach((stage: any, index: number) => (stage.orderIndex = index));
    expect(() => validateLessonDefinition(input)).toThrow();
  });

  it('rejects teacher intervention references to an unknown stage', () => {
    const input = validLesson();
    input.teacherPlan.interventionPoints[0].stageKey = 'DOES_NOT_EXIST';
    expect(() => validateLessonDefinition(input)).toThrow();
  });

  it('rejects reconnect without semantic-event deduplication', () => {
    const input = validLesson();
    input.offlinePolicy.deduplicatesByEventId = false;
    expect(() => validateLessonDefinition(input)).toThrow();
  });
});
