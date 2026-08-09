import { BadRequestException } from '@nestjs/common';
import type { ActivityDeliveryMode } from '@prisma/client';
import type { z } from 'zod';
import {
  validateActivityEngineCompatibility,
} from './activity-engine.registry';
import {
  accessibilityPlanSchema,
  assetManifestSchema,
  capabilityRequirementsSchema,
  dataPolicySchema,
  evidencePlanSchema,
  hardwareRequirementsSchema,
  modePolicySchema,
  offlinePolicySchema,
  safetyPlanSchema,
} from './activity-metadata.schemas';

export type PublicationCandidate = {
  engineKey: string;
  schemaVersion: number;
  supportedModes: ActivityDeliveryMode[];
  recommendedMode: ActivityDeliveryMode;
  interactionPrimitives: string[];
  config: unknown;
  capabilityRequirements: unknown;
  assetManifest: unknown;
  accessibilityPlan: unknown;
  hardwareRequirements: unknown;
  modePolicy: unknown;
  privacyPlan: unknown;
  safetyPlan: unknown;
  offlinePolicy: unknown;
  evidencePlan: unknown;
};

function parseOrThrow<T>(label: string, schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'ACTIVITY_PUBLICATION_METADATA_INVALID',
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

export function validateActivityPublicationMetadata(candidate: PublicationCandidate) {
  const engine = validateActivityEngineCompatibility({
    engineKey: candidate.engineKey,
    schemaVersion: candidate.schemaVersion,
    supportedModes: candidate.supportedModes,
    recommendedMode: candidate.recommendedMode,
    primitives: candidate.interactionPrimitives,
    config: candidate.config,
  });

  const capabilities = parseOrThrow(
    'capabilityRequirements',
    capabilityRequirementsSchema,
    candidate.capabilityRequirements,
  );
  const assets = parseOrThrow('assetManifest', assetManifestSchema, candidate.assetManifest);
  const accessibility = parseOrThrow(
    'accessibilityPlan',
    accessibilityPlanSchema,
    candidate.accessibilityPlan,
  );
  const hardware = parseOrThrow(
    'hardwareRequirements',
    hardwareRequirementsSchema,
    candidate.hardwareRequirements,
  );
  const modePolicy = parseOrThrow('modePolicy', modePolicySchema, candidate.modePolicy);
  const dataPolicy = parseOrThrow('privacyPlan', dataPolicySchema, candidate.privacyPlan);
  const safety = parseOrThrow('safetyPlan', safetyPlanSchema, candidate.safetyPlan);
  const offline = parseOrThrow('offlinePolicy', offlinePolicySchema, candidate.offlinePolicy);
  const evidence = parseOrThrow('evidencePlan', evidencePlanSchema, candidate.evidencePlan);

  const unsupportedCapabilities = capabilities.required.filter(
    (capability) => !engine.capabilities.includes(capability),
  );
  if (unsupportedCapabilities.length > 0) {
    throw new BadRequestException({
      code: 'ACTIVITY_ENGINE_CAPABILITY_UNSUPPORTED',
      unsupportedCapabilities,
    });
  }

  for (const mode of candidate.supportedModes) {
    if (!modePolicy[mode]) {
      throw new BadRequestException({ code: 'ACTIVITY_MODE_POLICY_MISSING', mode });
    }
  }

  if (!accessibility.keyboardPath || !accessibility.touchPath || !accessibility.nonColorCues) {
    throw new BadRequestException({ code: 'ACTIVITY_ACCESSIBILITY_BASELINE_INCOMPLETE' });
  }

  if (dataPolicy.rawMediaStorage) {
    throw new BadRequestException({ code: 'ACTIVITY_RAW_MEDIA_REQUIRES_SEPARATE_REVIEW' });
  }

  if (offline.reconnectable && !offline.deduplicatesByEventId) {
    throw new BadRequestException({ code: 'ACTIVITY_RECONNECT_IDEMPOTENCY_REQUIRED' });
  }

  if (assets.assets.some((asset) => !asset.commercialUse)) {
    throw new BadRequestException({ code: 'ACTIVITY_ASSET_COMMERCIAL_RIGHTS_REQUIRED' });
  }

  return {
    engine,
    capabilities,
    assets,
    accessibility,
    hardware,
    modePolicy,
    dataPolicy,
    safety,
    offline,
    evidence,
  };
}
