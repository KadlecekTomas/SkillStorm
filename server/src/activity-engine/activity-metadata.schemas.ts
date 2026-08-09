import { z } from 'zod';
import { ENGINE_CAPABILITIES } from './activity-engine.registry';

export const capabilityRequirementsSchema = z
  .object({ required: z.array(z.enum(ENGINE_CAPABILITIES)).default([]) })
  .strict();

export const assetManifestSchema = z
  .object({
    assets: z.array(
      z
        .object({
          id: z.string().trim().min(1).max(160),
          kind: z.enum(['IMAGE', 'AUDIO', 'VIDEO', 'MODEL_3D', 'DATASET', 'FONT', 'OTHER']),
          source: z.string().trim().min(1).max(2000),
          rightsBasis: z.string().trim().min(1).max(1000),
          commercialUse: z.boolean(),
          attribution: z.string().trim().max(1000).optional(),
          version: z.string().trim().max(200).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const accessibilityPlanSchema = z
  .object({
    keyboardPath: z.boolean(),
    touchPath: z.boolean(),
    reducedMotion: z.boolean(),
    nonColorCues: z.boolean(),
    instructionAlternative: z.boolean(),
    dragAlternative: z.boolean(),
  })
  .strict();

export const hardwareRequirementsSchema = z
  .object({
    minDevices: z.number().int().min(0).max(60),
    microphone: z.enum(['NONE', 'OPTIONAL', 'REQUIRED']),
    camera: z.enum(['NONE', 'OPTIONAL', 'REQUIRED']),
    webgl: z.enum(['NONE', 'OPTIONAL', 'REQUIRED']),
    pointer: z.enum(['MOUSE_OR_TOUCH', 'TOUCH_RECOMMENDED', 'ANY']),
  })
  .strict();

const modeEntrySchema = z
  .object({
    preservesObjective: z.boolean(),
    evidenceEquivalent: z.boolean(),
    fallback: z.string().trim().min(1).max(1000),
  })
  .strict();

export const modePolicySchema = z
  .object({
    BOARD_ONLY: modeEntrySchema.optional(),
    SHARED_DEVICES: modeEntrySchema.optional(),
    DEVICES: modeEntrySchema.optional(),
    HYBRID: modeEntrySchema.optional(),
  })
  .strict();

export const dataPolicySchema = z
  .object({
    storedData: z.array(z.string().trim().min(1).max(160)),
    rawMediaStorage: z.boolean(),
    retentionPolicy: z.string().trim().min(1).max(1000),
  })
  .strict();

export const safetyPlanSchema = z
  .object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    reviewLane: z.string().trim().min(1).max(500),
    teacherGate: z.boolean(),
    realWorldSafetyNote: z.string().trim().max(2000).optional(),
  })
  .strict();

export const offlinePolicySchema = z
  .object({
    mode: z.enum(['NONE', 'QUEUE_EVENTS', 'LOCAL_PROGRESS']),
    reconnectable: z.boolean(),
    deduplicatesByEventId: z.boolean(),
    maxOfflineSeconds: z.number().int().min(0).max(86400),
    fallback: z.string().trim().min(1).max(1000),
  })
  .strict();

const evidenceSignalSchema = z
  .object({
    type: z.string().trim().min(1).max(160),
    objectiveReference: z.string().trim().min(1).max(500),
    interpretation: z.string().trim().min(1).max(2000),
    rawOrDerived: z.enum(['RAW', 'DERIVED']),
  })
  .strict();

export const evidencePlanSchema = z
  .object({
    signals: z.array(evidenceSignalSchema).min(1),
    completionIsMastery: z.literal(false),
  })
  .strict();
