#!/usr/bin/env node
import fs from 'node:fs';

const schemaPath = 'server/prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

function modelRange(name) {
  const start = schema.indexOf(`model ${name} {`);
  if (start < 0) throw new Error(`Missing model ${name}`);
  const nextModel = schema.indexOf('\nmodel ', start + 1);
  const nextEnum = schema.indexOf('\nenum ', start + 1);
  const candidates = [nextModel, nextEnum].filter((v) => v >= 0);
  const end = candidates.length ? Math.min(...candidates) : schema.length;
  return { start, end };
}

function insertBeforeInModel(name, marker, addition) {
  const { start, end } = modelRange(name);
  const block = schema.slice(start, end);
  if (block.includes(addition.trim())) return;
  const index = block.indexOf(marker);
  if (index < 0) throw new Error(`Missing marker in ${name}: ${marker}`);
  if (block.indexOf(marker, index + marker.length) >= 0) {
    throw new Error(`Ambiguous marker in ${name}: ${marker}`);
  }
  const absolute = start + index;
  schema = schema.slice(0, absolute) + addition + schema.slice(absolute);
}

if (schema.includes('model LessonExperienceVersion {')) {
  throw new Error('D2-B schema already present; refusing double apply.');
}

insertBeforeInModel(
  'Organization',
  '  @@index([name])',
  '  lessonExperiences  LessonExperience[]\n\n',
);
insertBeforeInModel(
  'ActivityVersion',
  '  @@unique([activityId, versionNo])',
  '  lessonStages         LessonStage[]\n\n',
);
insertBeforeInModel(
  'CurriculumFrameworkRelease',
  '  @@unique([frameworkId, releaseCode])',
  '  lessonExperienceMappings LessonExperienceCurriculumMapping[] @relation("LessonExperienceMappingRelease")\n\n',
);
insertBeforeInModel(
  'FrameworkOutcome',
  '  @@unique([frameworkReleaseId, externalCode])',
  '  lessonExperienceMappings LessonExperienceCurriculumMapping[]\n\n',
);
insertBeforeInModel(
  'OutcomeAspect',
  '  @@unique([frameworkOutcomeId, code])',
  '  lessonExperienceMappings LessonExperienceCurriculumMapping[]\n\n',
);

const models = String.raw`
// -----------------------------------------------------------------------------
// Interactive Curriculum D2-B — immutable Lesson Experience definition layer.
// A version is created together with all ordered stages, then sealed by checksum.
// Runtime sessions / semantic-event orchestration are intentionally NOT here yet.
// -----------------------------------------------------------------------------

enum LessonExperienceScope {
  GLOBAL
  ORGANIZATION
}

enum LessonExperienceVersionStatus {
  DRAFT
  REVIEW
  PUBLISHED
  RETIRED
}

enum LessonStageType {
  HOOK
  PREDICTION
  EXPLORATION
  DISCOVERY
  TEACHER_INTERVENTION
  CHALLENGE
  REFLECTION
  EVIDENCE
}

enum LessonStageCompletionType {
  MANUAL
  ACTIVITY
  CHECKPOINT
}

enum LessonExperienceCurriculumMappingType {
  PRIMARY
  SUPPORTING
  RELATED
}

enum LessonExperienceCurriculumMappingStatus {
  PROPOSED
  APPROVED
  REJECTED
  STALE
}

model LessonExperience {
  id             String                @id @default(uuid()) @map("lesson_experience_id")
  scope          LessonExperienceScope
  organizationId String?               @map("organization_id")
  slug           String                @db.VarChar(160)
  title          String                @db.VarChar(300)
  description    String?               @db.Text
  createdById    String                @map("created_by_id")
  createdAt      DateTime              @default(now()) @map("created_at")
  updatedAt      DateTime              @updatedAt @map("updated_at")
  deletedAt      DateTime?             @map("deleted_at")
  organization   Organization?         @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  versions       LessonExperienceVersion[]

  @@index([organizationId, scope, deletedAt])
  @@index([scope, deletedAt])
  @@map("lesson_experiences")
}

model LessonExperienceVersion {
  id                     String                        @id @default(uuid()) @map("lesson_experience_version_id")
  lessonExperienceId     String                        @map("lesson_experience_id")
  versionNo              Int                           @map("version_no")
  status                 LessonExperienceVersionStatus @default(DRAFT)
  schemaVersion          Int                           @default(1) @map("schema_version")
  title                  String                        @db.VarChar(300)
  summary                String?                       @db.Text
  learningObjective      String                        @map("learning_objective") @db.Text
  pedagogicalRationale   String                        @map("pedagogical_rationale") @db.Text
  supportedModes         ActivityDeliveryMode[]        @map("supported_modes")
  recommendedMode        ActivityDeliveryMode          @map("recommended_mode")
  estimatedDurationMin   Int                           @map("estimated_duration_min")
  teacherPlan            Json                          @map("teacher_plan_json")
  hardwareRequirements   Json                          @map("hardware_requirements_json")
  accessibilityPlan      Json                          @map("accessibility_plan_json")
  privacyPlan            Json                          @map("privacy_plan_json")
  offlinePolicy          Json                          @map("offline_policy_json")
  assetManifest          Json                          @map("asset_manifest_json")
  contentChecksum        String?                       @map("content_checksum") @db.Char(64)
  sealedAt               DateTime?                     @map("sealed_at")
  reviewedAt             DateTime?                     @map("reviewed_at")
  reviewedBy             String?                       @map("reviewed_by")
  publishedAt            DateTime?                     @map("published_at")
  publishedBy            String?                       @map("published_by")
  createdAt              DateTime                      @default(now()) @map("created_at")
  updatedAt              DateTime                      @updatedAt @map("updated_at")
  lessonExperience       LessonExperience              @relation(fields: [lessonExperienceId], references: [id], onDelete: Restrict)
  stages                 LessonStage[]
  curriculumMappings     LessonExperienceCurriculumMapping[]

  @@unique([lessonExperienceId, versionNo])
  @@index([lessonExperienceId, contentChecksum])
  @@index([lessonExperienceId, status])
  @@index([status, publishedAt])
  @@map("lesson_experience_versions")
}

model LessonStage {
  id                        String                    @id @default(uuid()) @map("lesson_stage_id")
  lessonExperienceVersionId String                    @map("lesson_experience_version_id")
  stageKey                  String                    @map("stage_key") @db.VarChar(120)
  orderIndex                Int                       @map("order_index")
  stageType                 LessonStageType           @map("stage_type")
  title                     String                    @db.VarChar(300)
  studentPrompt             String?                   @map("student_prompt") @db.Text
  teacherGuidance           String?                   @map("teacher_guidance") @db.Text
  durationMin               Int                       @map("duration_min")
  activityVersionId         String?                   @map("activity_version_id")
  completionType            LessonStageCompletionType @default(MANUAL) @map("completion_type")
  checkpoint                Boolean                   @default(false)
  required                  Boolean                   @default(true)
  teacherIntervention       Boolean                   @default(false) @map("teacher_intervention")
  createdAt                 DateTime                  @default(now()) @map("created_at")
  lessonExperienceVersion   LessonExperienceVersion   @relation(fields: [lessonExperienceVersionId], references: [id], onDelete: Restrict)
  activityVersion           ActivityVersion?          @relation(fields: [activityVersionId], references: [id], onDelete: Restrict)

  @@unique([lessonExperienceVersionId, stageKey])
  @@unique([lessonExperienceVersionId, orderIndex])
  @@index([activityVersionId])
  @@map("lesson_stages")
}

model LessonExperienceCurriculumMapping {
  id                         String                                  @id @default(uuid()) @map("lesson_experience_curriculum_mapping_id")
  lessonExperienceVersionId  String                                  @map("lesson_experience_version_id")
  frameworkOutcomeId         String                                  @map("framework_outcome_id")
  outcomeAspectId            String?                                 @map("outcome_aspect_id")
  mappingType                LessonExperienceCurriculumMappingType   @map("mapping_type")
  status                     LessonExperienceCurriculumMappingStatus @default(PROPOSED)
  rationale                  String                                  @db.Text
  proposedByType             MappingProposerType                     @default(HUMAN) @map("proposed_by_type")
  proposedById               String?                                 @map("proposed_by_id")
  reviewRationale            String?                                 @map("review_rationale") @db.Text
  reviewedBy                 String?                                 @map("reviewed_by")
  reviewedAt                 DateTime?                               @map("reviewed_at")
  frameworkReleaseId         String                                  @map("framework_release_id")
  frameworkOutcomeChecksum   String                                  @map("framework_outcome_checksum") @db.Char(64)
  outcomeAspectReviewVersion Int?                                    @map("outcome_aspect_review_version")
  createdAt                  DateTime                                @default(now()) @map("created_at")
  updatedAt                  DateTime                                @updatedAt @map("updated_at")
  lessonExperienceVersion    LessonExperienceVersion                 @relation(fields: [lessonExperienceVersionId], references: [id], onDelete: Restrict)
  frameworkOutcome           FrameworkOutcome                        @relation(fields: [frameworkOutcomeId], references: [id], onDelete: Restrict)
  outcomeAspect              OutcomeAspect?                          @relation(fields: [outcomeAspectId], references: [id], onDelete: Restrict)
  frameworkRelease           CurriculumFrameworkRelease              @relation("LessonExperienceMappingRelease", fields: [frameworkReleaseId], references: [id], onDelete: Restrict)

  @@index([lessonExperienceVersionId, status])
  @@index([frameworkOutcomeId, status])
  @@index([outcomeAspectId, status])
  @@index([frameworkReleaseId])
  @@map("lesson_experience_curriculum_mappings")
}

`;

const insertion = schema.indexOf('enum SystemRole {');
if (insertion < 0) throw new Error('Missing SystemRole insertion point');
schema = schema.slice(0, insertion) + models + schema.slice(insertion);

const auditNeedle = '  ACTIVITY\n';
const auditPos = schema.indexOf(auditNeedle, schema.indexOf('enum AuditEntityType {'));
if (auditPos < 0) throw new Error('Missing ACTIVITY audit enum marker');
schema =
  schema.slice(0, auditPos) +
  '  ACTIVITY\n  LESSON_EXPERIENCE\n' +
  schema.slice(auditPos + auditNeedle.length);

fs.writeFileSync(schemaPath, schema);
fs.rmSync('scripts/internal/apply-lesson-d2b-schema.mjs');
fs.rmSync('.github/workflows/lesson-d2b-schema-bootstrap.yml');
