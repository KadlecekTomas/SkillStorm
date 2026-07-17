import { SchoolGrade } from '@prisma/client';
import { z } from 'zod';

/**
 * Zod schéma definice kampaně (content/campaigns/*.json).
 * Kampaň NENÍ v DB — soubor je jediný zdroj pravdy, validuje se při bootu
 * (fail-fast). Viz docs/campaigns.md a docs/campaigns-decisions.md (R1).
 */

const slug = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug: jen [a-z0-9-]');

const schoolGrade = z.nativeEnum(SchoolGrade);

/** Pořadí ročníků pro porovnávání rozsahu targetGrades. */
export const SCHOOL_GRADE_ORDER: SchoolGrade[] = [
  SchoolGrade.GRADE_1,
  SchoolGrade.GRADE_2,
  SchoolGrade.GRADE_3,
  SchoolGrade.GRADE_4,
  SchoolGrade.GRADE_5,
  SchoolGrade.GRADE_6,
  SchoolGrade.GRADE_7,
  SchoolGrade.GRADE_8,
  SchoolGrade.GRADE_9,
  SchoolGrade.HIGH_SCHOOL_YEAR_1,
  SchoolGrade.HIGH_SCHOOL_YEAR_2,
  SchoolGrade.HIGH_SCHOOL_YEAR_3,
  SchoolGrade.HIGH_SCHOOL_YEAR_4,
];

export const gradeIndex = (g: SchoolGrade): number =>
  SCHOOL_GRADE_ORDER.indexOf(g);

const stickerSchema = z.object({
  key: slug,
  name: z.string().min(1).max(60),
  emoji: z.string().min(1).max(8),
});

const fragmentSchema = z.object({
  kind: z.enum(['text', 'image']),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(2000),
});

const expeditionStepSchema = z.object({
  key: slug,
  title: z.string().min(1).max(80),
  scene: z.string().min(1).max(500),
  /** Háček po finish — silueta/jedna věta o další zastávce. */
  hook: z.string().min(1).max(200),
  sticker: stickerSchema,
});

const missionStepSchema = z.object({
  key: slug,
  title: z.string().min(1).max(80),
  scene: z.string().min(1).max(800),
  fragment: fragmentSchema,
  cliffhanger: z.string().min(1).max(300),
});

const campaignBase = {
  id: slug,
  version: z.number().int().positive(),
  title: z.string().min(1).max(80),
  subtitle: z.string().max(160).optional(),
  reviewStatus: z.enum(['draft', 'approved']),
  targetGrades: z.object({ min: schoolGrade, max: schoolGrade }),
  intro: z.string().min(1).max(600),
};

export const campaignDefinitionSchema = z
  .discriminatedUnion('type', [
    z.object({
      ...campaignBase,
      type: z.literal('EXPEDITION'),
      steps: z.array(expeditionStepSchema).min(2).max(16),
    }),
    z.object({
      ...campaignBase,
      type: z.literal('MISSION'),
      epilogue: z
        .object({ enabled: z.boolean(), prompt: z.string().min(1).max(300) })
        .optional(),
      steps: z.array(missionStepSchema).min(1).max(16),
    }),
  ])
  .superRefine((c, ctx) => {
    if (gradeIndex(c.targetGrades.min) > gradeIndex(c.targetGrades.max)) {
      ctx.addIssue({
        code: 'custom',
        message: 'targetGrades.min musí být ≤ targetGrades.max',
      });
    }
    const keys = new Set(c.steps.map((s) => s.key));
    if (keys.size !== c.steps.length) {
      ctx.addIssue({ code: 'custom', message: 'duplicitní step.key' });
    }
  });

export type CampaignDefinition = z.infer<typeof campaignDefinitionSchema>;
export type ExpeditionStep = z.infer<typeof expeditionStepSchema>;
export type MissionStep = z.infer<typeof missionStepSchema>;
export type CampaignStep = ExpeditionStep | MissionStep;
