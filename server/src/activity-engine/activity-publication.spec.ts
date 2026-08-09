import { ActivityDeliveryMode } from '@prisma/client';
import {
  validateActivityEngineCompatibility,
} from './activity-engine.registry';
import { validateActivityPublicationMetadata } from './activity-publication';

function validCandidate() {
  return {
    engineKey: 'CORE_INTERACTION_V1',
    schemaVersion: 1,
    supportedModes: [
      ActivityDeliveryMode.BOARD_ONLY,
      ActivityDeliveryMode.SHARED_DEVICES,
    ],
    recommendedMode: ActivityDeliveryMode.SHARED_DEVICES,
    interactionPrimitives: ['PREDICT', 'CHECKPOINT', 'REFLECT'],
    config: {
      kind: 'PREDICT',
      prompt: 'Co se podle tebe stane a proč?',
      content: {},
    },
    capabilityRequirements: {
      required: ['SEMANTIC_EVENTS', 'RECONNECTABLE'],
    },
    assetManifest: {
      assets: [
        {
          id: 'hero-illustration',
          kind: 'IMAGE',
          source: 'skillstorm://assets/hero-illustration',
          rightsBasis: 'SkillStorm original asset',
          commercialUse: true,
        },
      ],
    },
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
        evidenceEquivalent: false,
        fallback: 'Učitel vede společnou predikci na tabuli.',
      },
      SHARED_DEVICES: {
        preservesObjective: true,
        evidenceEquivalent: true,
        fallback: 'Skupiny pokračují společně na tabuli.',
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
      fallback: 'Pokračuj lokálně a po návratu sítě odešli semantic events.',
    },
    evidencePlan: {
      completionIsMastery: false,
      signals: [
        {
          type: 'PREDICTION_SUBMITTED',
          objectiveReference: 'mapped-outcome-aspect',
          interpretation: 'Dokládá počáteční model žáka, nikoli mastery.',
          rawOrDerived: 'RAW',
        },
      ],
    },
  };
}

describe('Activity Engine D2-A publication contract', () => {
  it('accepts a fully declared reusable activity contract', () => {
    expect(() => validateActivityPublicationMetadata(validCandidate())).not.toThrow();
  });

  it('rejects a recommended mode that is not supported', () => {
    const input: any = validCandidate();
    input.recommendedMode = ActivityDeliveryMode.DEVICES;
    expect(() =>
      validateActivityEngineCompatibility({
        engineKey: input.engineKey,
        schemaVersion: input.schemaVersion,
        supportedModes: input.supportedModes,
        recommendedMode: input.recommendedMode,
        primitives: input.interactionPrimitives,
        config: input.config,
      }),
    ).toThrow();
  });

  it('rejects publication without an explicit policy for every supported mode', () => {
    const input: any = validCandidate();
    delete input.modePolicy.SHARED_DEVICES;
    expect(() => validateActivityPublicationMetadata(input)).toThrow();
  });

  it('rejects publication when reconnect retry cannot be deduplicated', () => {
    const input = validCandidate();
    input.offlinePolicy.deduplicatesByEventId = false;
    expect(() => validateActivityPublicationMetadata(input)).toThrow();
  });

  it('keeps completion distinct from mastery', () => {
    const input: any = validCandidate();
    input.evidencePlan.completionIsMastery = true;
    expect(() => validateActivityPublicationMetadata(input)).toThrow();
  });

  it('rejects assets whose commercial-use rights are not established', () => {
    const input = validCandidate();
    input.assetManifest.assets[0]!.commercialUse = false;
    expect(() => validateActivityPublicationMetadata(input)).toThrow();
  });
});
