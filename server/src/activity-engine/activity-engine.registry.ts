import { BadRequestException } from '@nestjs/common';
import { ActivityDeliveryMode } from '@prisma/client';
import { z } from 'zod';

export const ACTIVITY_PRIMITIVES = [
  'SELECT',
  'MATCH',
  'SORT',
  'ORDER',
  'PREDICT',
  'MANIPULATE',
  'MEASURE',
  'SIMULATE',
  'BUILD',
  'DIAGNOSE',
  'MAP_LAYER',
  'DIALOGUE',
  'AUDIO_RESPONSE',
  'COLLABORATIVE_DECISION',
  'REFLECT',
  'EXPLAIN',
  'CHECKPOINT',
] as const;

export type ActivityPrimitive = (typeof ACTIVITY_PRIMITIVES)[number];

export const ENGINE_CAPABILITIES = [
  'SEMANTIC_EVENTS',
  'LOCAL_FIRST_INTERACTION',
  'SERVER_AUTHORITY',
  'BOARD_PROJECTION',
  'SHARED_GROUPS',
  'INDIVIDUAL_PARTICIPANTS',
  'TOUCH_INPUT',
  'KEYBOARD_INPUT',
  'REDUCED_MOTION',
  'RECONNECTABLE',
] as const;

export type EngineCapability = (typeof ENGINE_CAPABILITIES)[number];

const coreConfigSchema = z
  .object({
    kind: z.enum([
      'SELECT',
      'MATCH',
      'SORT',
      'ORDER',
      'PREDICT',
      'REFLECT',
      'EXPLAIN',
      'CHECKPOINT',
    ]),
    prompt: z.string().trim().min(1).max(4000),
    content: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type ActivityEngineDefinition = {
  key: string;
  schemaVersion: number;
  supportedModes: readonly ActivityDeliveryMode[];
  supportedPrimitives: readonly ActivityPrimitive[];
  capabilities: readonly EngineCapability[];
  configSchema: z.ZodType<unknown>;
};

const CORE_INTERACTION_V1: ActivityEngineDefinition = {
  key: 'CORE_INTERACTION_V1',
  schemaVersion: 1,
  supportedModes: [
    ActivityDeliveryMode.BOARD_ONLY,
    ActivityDeliveryMode.SHARED_DEVICES,
    ActivityDeliveryMode.DEVICES,
    ActivityDeliveryMode.HYBRID,
  ],
  supportedPrimitives: [
    'SELECT',
    'MATCH',
    'SORT',
    'ORDER',
    'PREDICT',
    'REFLECT',
    'EXPLAIN',
    'CHECKPOINT',
  ],
  capabilities: [
    'SEMANTIC_EVENTS',
    'LOCAL_FIRST_INTERACTION',
    'SERVER_AUTHORITY',
    'BOARD_PROJECTION',
    'SHARED_GROUPS',
    'INDIVIDUAL_PARTICIPANTS',
    'TOUCH_INPUT',
    'KEYBOARD_INPUT',
    'REDUCED_MOTION',
    'RECONNECTABLE',
  ],
  configSchema: coreConfigSchema,
};

const registry = new Map<string, ActivityEngineDefinition>([
  [CORE_INTERACTION_V1.key, CORE_INTERACTION_V1],
]);

export function listActivityEngines(): Array<
  Omit<ActivityEngineDefinition, 'configSchema'>
> {
  return [...registry.values()].map(({ configSchema: _schema, ...definition }) =>
    definition,
  );
}

export function requireActivityEngine(key: string): ActivityEngineDefinition {
  const engine = registry.get(key);
  if (!engine) {
    throw new BadRequestException({
      code: 'ACTIVITY_ENGINE_UNKNOWN',
      message: `Neznámý Activity Engine: ${key}`,
    });
  }
  return engine;
}

export type ActivityEngineCompatibilityInput = {
  engineKey: string;
  schemaVersion: number;
  supportedModes: ActivityDeliveryMode[];
  recommendedMode: ActivityDeliveryMode;
  primitives: string[];
  config: unknown;
};

export function validateActivityEngineCompatibility(
  input: ActivityEngineCompatibilityInput,
): ActivityEngineDefinition {
  const engine = requireActivityEngine(input.engineKey);

  if (input.schemaVersion !== engine.schemaVersion) {
    throw new BadRequestException({
      code: 'ACTIVITY_ENGINE_SCHEMA_VERSION_UNSUPPORTED',
      message: `${engine.key} podporuje schemaVersion ${engine.schemaVersion}.`,
    });
  }

  const uniqueModes = [...new Set(input.supportedModes)];
  if (uniqueModes.length === 0) {
    throw new BadRequestException({
      code: 'ACTIVITY_DELIVERY_MODES_EMPTY',
      message: 'ActivityVersion musí podporovat alespoň jeden delivery mode.',
    });
  }
  if (!uniqueModes.includes(input.recommendedMode)) {
    throw new BadRequestException({
      code: 'ACTIVITY_RECOMMENDED_MODE_UNSUPPORTED',
      message: 'recommendedMode musí být součástí supportedModes.',
    });
  }

  const unsupportedModes = uniqueModes.filter(
    (mode) => !engine.supportedModes.includes(mode),
  );
  if (unsupportedModes.length > 0) {
    throw new BadRequestException({
      code: 'ACTIVITY_ENGINE_MODE_UNSUPPORTED',
      unsupportedModes,
    });
  }

  const uniquePrimitives = [...new Set(input.primitives)];
  if (uniquePrimitives.length === 0) {
    throw new BadRequestException({
      code: 'ACTIVITY_PRIMITIVES_EMPTY',
      message: 'ActivityVersion musí deklarovat alespoň jednu interakční primitive.',
    });
  }
  const unknownPrimitives = uniquePrimitives.filter(
    (primitive) =>
      !(ACTIVITY_PRIMITIVES as readonly string[]).includes(primitive),
  );
  if (unknownPrimitives.length > 0) {
    throw new BadRequestException({
      code: 'ACTIVITY_PRIMITIVE_UNKNOWN',
      unknownPrimitives,
    });
  }
  const unsupportedPrimitives = uniquePrimitives.filter(
    (primitive) =>
      !engine.supportedPrimitives.includes(primitive as ActivityPrimitive),
  );
  if (unsupportedPrimitives.length > 0) {
    throw new BadRequestException({
      code: 'ACTIVITY_ENGINE_PRIMITIVE_UNSUPPORTED',
      unsupportedPrimitives,
    });
  }

  const configResult = engine.configSchema.safeParse(input.config);
  if (!configResult.success) {
    throw new BadRequestException({
      code: 'ACTIVITY_ENGINE_CONFIG_INVALID',
      issues: configResult.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return engine;
}
