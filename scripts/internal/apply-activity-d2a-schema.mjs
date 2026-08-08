#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'server/prisma/schema.prisma');
const migrationDir = path.join(root, 'server/prisma/migrations/20260809010500_activity_engine_d2a');
const migrationPath = path.join(migrationDir, 'migration.sql');
const selfPath = path.join(root, 'scripts/internal/apply-activity-d2a-schema.mjs');
const workflowPath = path.join(root, '.github/workflows/activity-d2a-schema-bootstrap.yml');

function replaceOnce(input, needle, replacement, label) {
  const first = input.indexOf(needle);
  if (first < 0) throw new Error(`Missing patch marker: ${label}`);
  if (input.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Ambiguous patch marker: ${label}`);
  }
  return input.replace(needle, replacement);
}

let schema = fs.readFileSync(schemaPath, 'utf8');
if (schema.includes('model ActivityVersion {')) {
  throw new Error('Activity D2-A schema already present; refusing double apply.');
}

schema = replaceOnce(
  schema,
  '  curriculumApplicabilities CurriculumApplicability[]\n',
  '  curriculumApplicabilities CurriculumApplicability[]\n  activities          Activity[]\n',
  'Organization activity relation',
);

schema = replaceOnce(
  schema,
  '  schoolMappings    SchoolOutcomeMapping[]           @relation("SchoolOutcomeMappingRelease")\n',
  '  schoolMappings    SchoolOutcomeMapping[]           @relation("SchoolOutcomeMappingRelease")\n  activityMappings  ActivityCurriculumMapping[]      @relation("ActivityCurriculumMappingRelease")\n',
  'Framework release activity mappings',
);

schema = replaceOnce(
  schema,
  '  schoolMappings     SchoolOutcomeMapping[]\n',
  '  schoolMappings     SchoolOutcomeMapping[]\n  activityMappings   ActivityCurriculumMapping[]\n',
  'Framework outcome activity mappings',
);

schema = replaceOnce(
  schema,
  '  schoolMappings          SchoolOutcomeMapping[]\n',
  '  schoolMappings          SchoolOutcomeMapping[]\n  activityMappings        ActivityCurriculumMapping[]\n',
  'Outcome aspect activity mappings',
);

schema = replaceOnce(
  schema,
  '  CURRICULUM\n}',
  '  CURRICULUM\n  ACTIVITY\n}',
  'AuditEntityType activity member',
);

const activitySchema = String.raw`
// -----------------------------------------------------------------------------
// Interactive Curriculum D2-A — reusable Activity Engine definition layer.
// ActivityVersion is an immutable content snapshot. Editing means creating a
// new version; status/review/publication metadata are the only mutable fields.
// -----------------------------------------------------------------------------

enum ActivityScope {
  GLOBAL
  ORGANIZATION
}

enum ActivityVersionStatus {
  DRAFT
  REVIEW
  PUBLISHED
  RETIRED
}

enum ActivityDeliveryMode {
  BOARD_ONLY
  SHARED_DEVICES
  DEVICES
  HYBRID
}

enum ActivityCurriculumMappingType {
  PRIMARY
  SUPPORTING
  RELATED
}

enum ActivityCurriculumMappingStatus {
  PROPOSED
  APPROVED
  REJECTED
  STALE
}

model Activity {
  id             String        @id @default(uuid()) @map("activity_id")
  scope          ActivityScope
  organizationId String?       @map("organization_id")
  slug           String        @db.VarChar(160)
  title          String        @db.VarChar(300)
  description    String?       @db.Text
  createdById    String        @map("created_by_id")
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")
  deletedAt      DateTime?     @map("deleted_at")
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  versions       ActivityVersion[]

  @@index([organizationId, scope, deletedAt])
  @@index([scope, deletedAt])
  @@map("activities")
}

model ActivityVersion {
  id                     String                @id @default(uuid()) @map("activity_version_id")
  activityId             String                @map("activity_id")
  versionNo              Int                   @map("version_no")
  status                 ActivityVersionStatus @default(DRAFT)
  engineKey              String                @map("engine_key") @db.VarChar(120)
  schemaVersion          Int                   @map("schema_version")
  title                  String                @db.VarChar(300)
  description            String?               @db.Text
  supportedModes         ActivityDeliveryMode[] @map("supported_modes")
  recommendedMode        ActivityDeliveryMode  @map("recommended_mode")
  interactionPrimitives  String[]              @map("interaction_primitives")
  config                 Json                  @map("config_json")
  capabilityRequirements Json                  @map("capability_requirements_json")
  assetManifest          Json                  @map("asset_manifest_json")
  accessibilityPlan      Json                  @map("accessibility_plan_json")
  hardwareRequirements   Json                  @map("hardware_requirements_json")
  modePolicy             Json                  @map("mode_policy_json")
  privacyPlan            Json                  @map("privacy_plan_json")
  safetyPlan             Json                  @map("safety_plan_json")
  offlinePolicy          Json                  @map("offline_policy_json")
  evidencePlan           Json                  @map("evidence_plan_json")
  prerequisites          Json?                 @map("prerequisites_json")
  contentChecksum        String                @map("content_checksum") @db.Char(64)
  reviewedAt             DateTime?             @map("reviewed_at")
  reviewedBy             String?               @map("reviewed_by")
  publishedAt            DateTime?             @map("published_at")
  publishedBy            String?               @map("published_by")
  createdAt              DateTime              @default(now()) @map("created_at")
  updatedAt              DateTime              @updatedAt @map("updated_at")
  activity               Activity              @relation(fields: [activityId], references: [id], onDelete: Restrict)
  curriculumMappings     ActivityCurriculumMapping[]

  @@unique([activityId, versionNo])
  @@unique([activityId, contentChecksum])
  @@index([activityId, status])
  @@index([engineKey, schemaVersion])
  @@index([status, publishedAt])
  @@map("activity_versions")
}

model ActivityCurriculumMapping {
  id                         String                          @id @default(uuid()) @map("activity_curriculum_mapping_id")
  activityVersionId          String                          @map("activity_version_id")
  frameworkOutcomeId         String                          @map("framework_outcome_id")
  outcomeAspectId            String?                         @map("outcome_aspect_id")
  mappingType                ActivityCurriculumMappingType   @map("mapping_type")
  status                     ActivityCurriculumMappingStatus @default(PROPOSED)
  rationale                  String                          @db.Text
  proposedByType             MappingProposerType             @default(HUMAN) @map("proposed_by_type")
  proposedById               String?                         @map("proposed_by_id")
  reviewRationale            String?                         @map("review_rationale") @db.Text
  reviewedBy                 String?                         @map("reviewed_by")
  reviewedAt                 DateTime?                       @map("reviewed_at")
  frameworkReleaseId         String                          @map("framework_release_id")
  frameworkOutcomeChecksum   String                          @map("framework_outcome_checksum") @db.Char(64)
  outcomeAspectReviewVersion Int?                            @map("outcome_aspect_review_version")
  createdAt                  DateTime                        @default(now()) @map("created_at")
  updatedAt                  DateTime                        @updatedAt @map("updated_at")
  activityVersion            ActivityVersion                 @relation(fields: [activityVersionId], references: [id], onDelete: Restrict)
  frameworkOutcome           FrameworkOutcome                @relation(fields: [frameworkOutcomeId], references: [id], onDelete: Restrict)
  outcomeAspect              OutcomeAspect?                  @relation(fields: [outcomeAspectId], references: [id], onDelete: Restrict)
  frameworkRelease           CurriculumFrameworkRelease      @relation("ActivityCurriculumMappingRelease", fields: [frameworkReleaseId], references: [id], onDelete: Restrict)

  @@index([activityVersionId, status])
  @@index([frameworkOutcomeId, status])
  @@index([outcomeAspectId, status])
  @@index([frameworkReleaseId])
  @@map("activity_curriculum_mappings")
}

`;

schema = replaceOnce(
  schema,
  'enum SystemRole {',
  `${activitySchema}enum SystemRole {`,
  'activity models insertion point',
);
fs.writeFileSync(schemaPath, schema);

const sql = String.raw`-- Interactive Curriculum D2-A — Activity Engine foundation.
-- Additive only. Existing Test/Question/LiveSession runtime remains untouched.

CREATE TYPE "ActivityScope" AS ENUM ('GLOBAL', 'ORGANIZATION');
CREATE TYPE "ActivityVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED');
CREATE TYPE "ActivityDeliveryMode" AS ENUM ('BOARD_ONLY', 'SHARED_DEVICES', 'DEVICES', 'HYBRID');
CREATE TYPE "ActivityCurriculumMappingType" AS ENUM ('PRIMARY', 'SUPPORTING', 'RELATED');
CREATE TYPE "ActivityCurriculumMappingStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'STALE');

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'ACTIVITY';

CREATE TABLE "activities" (
  "activity_id" TEXT NOT NULL,
  "scope" "ActivityScope" NOT NULL,
  "organization_id" TEXT,
  "slug" VARCHAR(160) NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "description" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "activities_pkey" PRIMARY KEY ("activity_id"),
  CONSTRAINT "activity_scope_organization_check" CHECK (
    ("scope" = 'GLOBAL' AND "organization_id" IS NULL)
    OR ("scope" = 'ORGANIZATION' AND "organization_id" IS NOT NULL)
  )
);

CREATE TABLE "activity_versions" (
  "activity_version_id" TEXT NOT NULL,
  "activity_id" TEXT NOT NULL,
  "version_no" INTEGER NOT NULL,
  "status" "ActivityVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "engine_key" VARCHAR(120) NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "description" TEXT,
  "supported_modes" "ActivityDeliveryMode"[] NOT NULL,
  "recommended_mode" "ActivityDeliveryMode" NOT NULL,
  "interaction_primitives" TEXT[] NOT NULL,
  "config_json" JSONB NOT NULL,
  "capability_requirements_json" JSONB NOT NULL,
  "asset_manifest_json" JSONB NOT NULL,
  "accessibility_plan_json" JSONB NOT NULL,
  "hardware_requirements_json" JSONB NOT NULL,
  "mode_policy_json" JSONB NOT NULL,
  "privacy_plan_json" JSONB NOT NULL,
  "safety_plan_json" JSONB NOT NULL,
  "offline_policy_json" JSONB NOT NULL,
  "evidence_plan_json" JSONB NOT NULL,
  "prerequisites_json" JSONB,
  "content_checksum" CHAR(64) NOT NULL,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "published_at" TIMESTAMP(3),
  "published_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activity_versions_pkey" PRIMARY KEY ("activity_version_id"),
  CONSTRAINT "activity_version_number_check" CHECK ("version_no" >= 1),
  CONSTRAINT "activity_version_schema_check" CHECK ("schema_version" >= 1),
  CONSTRAINT "activity_version_modes_check" CHECK (cardinality("supported_modes") >= 1),
  CONSTRAINT "activity_version_primitives_check" CHECK (cardinality("interaction_primitives") >= 1),
  CONSTRAINT "activity_version_recommended_mode_check" CHECK ("recommended_mode" = ANY("supported_modes")),
  CONSTRAINT "activity_version_lifecycle_metadata_check" CHECK (
    ("status" = 'DRAFT' AND "reviewed_at" IS NULL AND "reviewed_by" IS NULL AND "published_at" IS NULL AND "published_by" IS NULL)
    OR ("status" = 'REVIEW' AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "published_at" IS NULL AND "published_by" IS NULL)
    OR ("status" IN ('PUBLISHED', 'RETIRED') AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "published_at" IS NOT NULL AND "published_by" IS NOT NULL)
  )
);

CREATE TABLE "activity_curriculum_mappings" (
  "activity_curriculum_mapping_id" TEXT NOT NULL,
  "activity_version_id" TEXT NOT NULL,
  "framework_outcome_id" TEXT NOT NULL,
  "outcome_aspect_id" TEXT,
  "mapping_type" "ActivityCurriculumMappingType" NOT NULL,
  "status" "ActivityCurriculumMappingStatus" NOT NULL DEFAULT 'PROPOSED',
  "rationale" TEXT NOT NULL,
  "proposed_by_type" "MappingProposerType" NOT NULL DEFAULT 'HUMAN',
  "proposed_by_id" TEXT,
  "review_rationale" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "framework_release_id" TEXT NOT NULL,
  "framework_outcome_checksum" CHAR(64) NOT NULL,
  "outcome_aspect_review_version" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activity_curriculum_mappings_pkey" PRIMARY KEY ("activity_curriculum_mapping_id"),
  CONSTRAINT "activity_curriculum_mapping_review_check" CHECK (
    ("status" = 'PROPOSED' AND "reviewed_at" IS NULL AND "reviewed_by" IS NULL AND "review_rationale" IS NULL)
    OR ("status" IN ('APPROVED', 'REJECTED') AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "review_rationale" IS NOT NULL)
    OR "status" = 'STALE'
  )
);

CREATE INDEX "activities_organization_id_scope_deleted_at_idx" ON "activities"("organization_id", "scope", "deleted_at");
CREATE INDEX "activities_scope_deleted_at_idx" ON "activities"("scope", "deleted_at");
CREATE UNIQUE INDEX "activities_global_slug_live_key" ON "activities"("slug") WHERE "scope" = 'GLOBAL' AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "activities_org_slug_live_key" ON "activities"("organization_id", "slug") WHERE "scope" = 'ORGANIZATION' AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "activity_versions_activity_id_version_no_key" ON "activity_versions"("activity_id", "version_no");
CREATE UNIQUE INDEX "activity_versions_activity_id_content_checksum_key" ON "activity_versions"("activity_id", "content_checksum");
CREATE INDEX "activity_versions_activity_id_status_idx" ON "activity_versions"("activity_id", "status");
CREATE INDEX "activity_versions_engine_key_schema_version_idx" ON "activity_versions"("engine_key", "schema_version");
CREATE INDEX "activity_versions_status_published_at_idx" ON "activity_versions"("status", "published_at");

CREATE INDEX "activity_curriculum_mappings_activity_version_id_status_idx" ON "activity_curriculum_mappings"("activity_version_id", "status");
CREATE INDEX "activity_curriculum_mappings_framework_outcome_id_status_idx" ON "activity_curriculum_mappings"("framework_outcome_id", "status");
CREATE INDEX "activity_curriculum_mappings_outcome_aspect_id_status_idx" ON "activity_curriculum_mappings"("outcome_aspect_id", "status");
CREATE INDEX "activity_curriculum_mappings_framework_release_id_idx" ON "activity_curriculum_mappings"("framework_release_id");
CREATE UNIQUE INDEX "activity_mapping_live_outcome_key" ON "activity_curriculum_mappings"("activity_version_id", "framework_outcome_id") WHERE "outcome_aspect_id" IS NULL AND "status" IN ('PROPOSED', 'APPROVED');
CREATE UNIQUE INDEX "activity_mapping_live_aspect_key" ON "activity_curriculum_mappings"("activity_version_id", "framework_outcome_id", "outcome_aspect_id") WHERE "outcome_aspect_id" IS NOT NULL AND "status" IN ('PROPOSED', 'APPROVED');

ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_versions" ADD CONSTRAINT "activity_versions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("activity_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_curriculum_mappings" ADD CONSTRAINT "activity_curriculum_mappings_activity_version_id_fkey" FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("activity_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_curriculum_mappings" ADD CONSTRAINT "activity_curriculum_mappings_framework_outcome_id_fkey" FOREIGN KEY ("framework_outcome_id") REFERENCES "framework_outcomes"("framework_outcome_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_curriculum_mappings" ADD CONSTRAINT "activity_curriculum_mappings_outcome_aspect_id_fkey" FOREIGN KEY ("outcome_aspect_id") REFERENCES "outcome_aspects"("outcome_aspect_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_curriculum_mappings" ADD CONSTRAINT "activity_curriculum_mappings_framework_release_id_fkey" FOREIGN KEY ("framework_release_id") REFERENCES "curriculum_framework_releases"("curriculum_framework_release_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION activity_version_snapshot_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ACTIVITY_VERSION_IMMUTABLE';
  END IF;

  IF (to_jsonb(NEW) - ARRAY['status','reviewed_at','reviewed_by','published_at','published_by','updated_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','reviewed_at','reviewed_by','published_at','published_by','updated_at']) THEN
    RAISE EXCEPTION 'ACTIVITY_VERSION_CONTENT_IMMUTABLE';
  END IF;

  IF NEW."status" = OLD."status" THEN
    RAISE EXCEPTION 'ACTIVITY_VERSION_STATUS_NOOP';
  END IF;

  IF NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" = 'REVIEW')
    OR (OLD."status" = 'REVIEW' AND NEW."status" = 'PUBLISHED')
    OR (OLD."status" = 'PUBLISHED' AND NEW."status" = 'RETIRED')
  ) THEN
    RAISE EXCEPTION 'ACTIVITY_VERSION_STATUS_TRANSITION_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER activity_version_snapshot_guard_trigger BEFORE UPDATE OR DELETE ON "activity_versions" FOR EACH ROW EXECUTE FUNCTION activity_version_snapshot_guard();

CREATE OR REPLACE FUNCTION activity_mapping_consistency_guard() RETURNS TRIGGER AS $$
DECLARE version_status "ActivityVersionStatus";
DECLARE release_id TEXT;
DECLARE release_status "CurriculumFrameworkReleaseStatus";
DECLARE outcome_checksum CHAR(64);
DECLARE aspect_outcome_id TEXT;
DECLARE aspect_review_version INTEGER;
DECLARE aspect_status "OutcomeAspectStatus";
BEGIN
  SELECT "status" INTO version_status FROM "activity_versions" WHERE "activity_version_id" = NEW."activity_version_id";
  SELECT fo."framework_release_id", fo."checksum", r."status"
    INTO release_id, outcome_checksum, release_status
  FROM "framework_outcomes" fo
  JOIN "curriculum_framework_releases" r ON r."curriculum_framework_release_id" = fo."framework_release_id"
  WHERE fo."framework_outcome_id" = NEW."framework_outcome_id";

  IF version_status IS NULL OR release_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_MAPPING_REFERENCE_MISSING';
  END IF;
  IF release_id <> NEW."framework_release_id" THEN
    RAISE EXCEPTION 'ACTIVITY_MAPPING_RELEASE_MISMATCH';
  END IF;

  IF NEW."outcome_aspect_id" IS NOT NULL THEN
    SELECT "framework_outcome_id", "review_version", "status"
      INTO aspect_outcome_id, aspect_review_version, aspect_status
    FROM "outcome_aspects"
    WHERE "outcome_aspect_id" = NEW."outcome_aspect_id";
    IF aspect_outcome_id IS NULL OR aspect_outcome_id <> NEW."framework_outcome_id" THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_ASPECT_OUTCOME_MISMATCH';
    END IF;
  ELSE
    aspect_review_version := NULL;
    aspect_status := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF version_status NOT IN ('DRAFT', 'REVIEW') THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_VERSION_FROZEN';
    END IF;
    IF release_status <> 'VERIFIED' THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_RELEASE_NOT_VERIFIED';
    END IF;
    IF aspect_status IS NOT NULL AND aspect_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_ASPECT_RETIRED';
    END IF;
    IF NEW."framework_outcome_checksum" <> outcome_checksum OR NEW."outcome_aspect_review_version" IS DISTINCT FROM aspect_review_version THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_PROVENANCE_MISMATCH';
    END IF;
  ELSIF version_status IN ('PUBLISHED', 'RETIRED') THEN
    IF NOT (OLD."status" = 'APPROVED' AND NEW."status" = 'STALE') THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_VERSION_FROZEN';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at']) THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_VERSION_FROZEN';
    END IF;
  END IF;

  IF NEW."status" <> 'STALE' AND (
    NEW."framework_outcome_checksum" <> outcome_checksum
    OR NEW."outcome_aspect_review_version" IS DISTINCT FROM aspect_review_version
  ) THEN
    RAISE EXCEPTION 'ACTIVITY_MAPPING_STALE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER activity_mapping_consistency_guard_trigger BEFORE INSERT OR UPDATE ON "activity_curriculum_mappings" FOR EACH ROW EXECUTE FUNCTION activity_mapping_consistency_guard();

CREATE OR REPLACE FUNCTION activity_mapping_history_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ACTIVITY_MAPPING_HISTORY_IMMUTABLE';
  END IF;
  IF OLD."status" IN ('REJECTED', 'STALE') THEN
    RAISE EXCEPTION 'ACTIVITY_MAPPING_HISTORY_IMMUTABLE';
  END IF;
  IF OLD."status" = 'APPROVED' THEN
    IF NEW."status" <> 'STALE' THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_APPROVAL_IMMUTABLE';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at']) THEN
      RAISE EXCEPTION 'ACTIVITY_MAPPING_APPROVAL_IMMUTABLE';
    END IF;
  ELSIF OLD."status" = 'PROPOSED' AND NEW."status" NOT IN ('APPROVED', 'REJECTED', 'STALE') THEN
    RAISE EXCEPTION 'ACTIVITY_MAPPING_STATUS_TRANSITION_INVALID';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER activity_mapping_history_guard_trigger BEFORE UPDATE OR DELETE ON "activity_curriculum_mappings" FOR EACH ROW EXECUTE FUNCTION activity_mapping_history_guard();
`;

fs.mkdirSync(migrationDir, { recursive: true });
if (fs.existsSync(migrationPath)) throw new Error('D2-A migration already exists.');
fs.writeFileSync(migrationPath, sql);

if (fs.existsSync(selfPath)) fs.rmSync(selfPath);
if (fs.existsSync(workflowPath)) fs.rmSync(workflowPath);
console.log('Activity D2-A schema and migration applied; bootstrap files removed.');
