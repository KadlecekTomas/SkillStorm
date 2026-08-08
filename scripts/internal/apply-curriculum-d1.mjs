#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'server/prisma/schema.prisma');
const appModulePath = path.join(root, 'server/src/app.module.ts');
const migrationDir = path.join(
  root,
  'server/prisma/migrations/20260809005500_curriculum_foundation_d1',
);
const migrationPath = path.join(migrationDir, 'migration.sql');
const selfPath = path.join(root, 'scripts/internal/apply-curriculum-d1.mjs');
const workflowPath = path.join(root, '.github/workflows/curriculum-d1-bootstrap.yml');

function replaceOnce(input, needle, replacement, label) {
  const first = input.indexOf(needle);
  if (first < 0) throw new Error(`Missing patch marker: ${label}`);
  if (input.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Ambiguous patch marker: ${label}`);
  }
  return input.replace(needle, replacement);
}

let schema = fs.readFileSync(schemaPath, 'utf8');
if (schema.includes('model CurriculumFramework {')) {
  throw new Error('Curriculum D1 schema already present; refusing double apply.');
}

schema = replaceOnce(
  schema,
  '  learningSessions   LearningSession[]\n',
  '  learningSessions   LearningSession[]\n  schoolCurriculumProfiles SchoolCurriculumProfile[]\n  curriculumApplicabilities CurriculumApplicability[]\n',
  'Organization curriculum relations',
);

schema = replaceOnce(
  schema,
  '  teacherClassSections TeacherClassSection[]\n\n  @@unique([orgId, label])',
  '  teacherClassSections TeacherClassSection[]\n  curriculumApplicabilities CurriculumApplicability[]\n\n  @@unique([orgId, label])',
  'AcademicYear curriculum relations',
);

schema = replaceOnce(
  schema,
  '  campaignProgresses CampaignProgress[]\n\n  @@unique([orgId, yearId, grade, section])',
  '  campaignProgresses CampaignProgress[]\n  curriculumApplicabilities CurriculumApplicability[]\n\n  @@unique([orgId, yearId, grade, section])',
  'ClassSection curriculum relations',
);

schema = replaceOnce(
  schema,
  `enum AuditEntityType {
  USER
  ORGANIZATION
  CLASSROOM
  TEST
  LEARNING_MATERIAL
  PERMISSION
  STUDENT
  SUPPORT_TICKET
  CATALOG_SUBJECT
  CATALOG_TOPIC
  PROGRESS
}`,
  `enum AuditEntityType {
  USER
  ORGANIZATION
  CLASSROOM
  TEST
  LEARNING_MATERIAL
  PERMISSION
  STUDENT
  SUPPORT_TICKET
  CATALOG_SUBJECT
  CATALOG_TOPIC
  PROGRESS
  CURRICULUM
}`,
  'AuditEntityType curriculum member',
);

const curriculumSchema = String.raw`
// -----------------------------------------------------------------------------
// Interactive Curriculum D1 — canonical framework + school ŠVP foundation.
// Normative contract: docs/interactive-curriculum/CURRICULUM-DATA-CONTRACT.md
// Published/verified immutability and cross-tenant applicability invariants are
// enforced again at DB level by migration 20260809005500_curriculum_foundation_d1.
// -----------------------------------------------------------------------------

enum CurriculumFrameworkReleaseStatus {
  IMPORTED
  VERIFIED
  SUPERSEDED
}

enum OutcomeAspectStatus {
  ACTIVE
  RETIRED
}

enum SchoolCurriculumProfileStatus {
  ACTIVE
  ARCHIVED
}

enum SchoolCurriculumSourceType {
  UPLOAD
  MANUAL
  TEMPLATE
  IMPORT
}

enum SchoolCurriculumVersionStatus {
  DRAFT
  REVIEW
  PUBLISHED
  RETIRED
}

enum CurriculumApplicabilityStatus {
  ACTIVE
  RETIRED
}

enum SchoolOutcomeMappingType {
  EXACT
  PARTIAL
  SUPPORTING
  RELATED
}

enum SchoolOutcomeMappingStatus {
  PROPOSED
  REVIEWED
  APPROVED
  REJECTED
  STALE
}

enum MappingProposerType {
  HUMAN
  SYSTEM
  AI
}

model CurriculumFramework {
  id            String                       @id @default(uuid()) @map("curriculum_framework_id")
  code          String                       @unique @db.VarChar(100)
  jurisdiction  String                       @db.VarChar(10)
  educationType String                       @map("education_type") @db.VarChar(100)
  title         String                       @db.VarChar(255)
  authorityName String                       @map("authority_name") @db.VarChar(255)
  createdAt     DateTime                     @default(now()) @map("created_at")
  updatedAt     DateTime                     @updatedAt @map("updated_at")
  releases      CurriculumFrameworkRelease[]

  @@index([jurisdiction, educationType])
  @@map("curriculum_frameworks")
}

model CurriculumFrameworkRelease {
  id                String                           @id @default(uuid()) @map("curriculum_framework_release_id")
  frameworkId       String                           @map("framework_id")
  releaseCode       String                           @map("release_code") @db.VarChar(160)
  title             String                           @db.VarChar(500)
  sourceUrl         String                           @map("source_url") @db.Text
  sourceAuthority   String                           @map("source_authority") @db.VarChar(255)
  sourcePublishedAt DateTime?                        @map("source_published_at")
  effectiveFrom     DateTime?                        @map("effective_from")
  effectiveTo       DateTime?                        @map("effective_to")
  importedAt        DateTime                         @default(now()) @map("imported_at")
  sourceChecksum    String                           @map("source_checksum") @db.Char(64)
  sourceMetadata    Json?                            @map("source_metadata_json")
  status            CurriculumFrameworkReleaseStatus @default(IMPORTED)
  verifiedAt        DateTime?                        @map("verified_at")
  verifiedBy        String?                          @map("verified_by")
  createdAt         DateTime                         @default(now()) @map("created_at")
  framework         CurriculumFramework              @relation(fields: [frameworkId], references: [id], onDelete: Restrict)
  areas             FrameworkArea[]
  fields            FrameworkField[]
  outcomes          FrameworkOutcome[]
  applicabilities   CurriculumApplicability[]
  schoolMappings    SchoolOutcomeMapping[]           @relation("SchoolOutcomeMappingRelease")

  @@unique([frameworkId, releaseCode])
  @@unique([frameworkId, sourceChecksum])
  @@index([frameworkId, status])
  @@index([effectiveFrom, effectiveTo])
  @@map("curriculum_framework_releases")
}

model FrameworkArea {
  id                 String                     @id @default(uuid()) @map("framework_area_id")
  frameworkReleaseId String                     @map("framework_release_id")
  externalCode       String                     @map("external_code") @db.VarChar(160)
  title              String                     @db.VarChar(500)
  description        String?                    @db.Text
  sortOrder          Int                        @map("sort_order")
  release            CurriculumFrameworkRelease @relation(fields: [frameworkReleaseId], references: [id], onDelete: Restrict)
  fields             FrameworkField[]

  @@unique([frameworkReleaseId, externalCode])
  @@index([frameworkReleaseId, sortOrder])
  @@map("framework_areas")
}

model FrameworkField {
  id                 String                     @id @default(uuid()) @map("framework_field_id")
  frameworkReleaseId String                     @map("framework_release_id")
  areaId             String                     @map("area_id")
  externalCode       String                     @map("external_code") @db.VarChar(160)
  title              String                     @db.VarChar(500)
  description        String?                    @db.Text
  sortOrder          Int                        @map("sort_order")
  release            CurriculumFrameworkRelease @relation(fields: [frameworkReleaseId], references: [id], onDelete: Restrict)
  area               FrameworkArea              @relation(fields: [areaId], references: [id], onDelete: Restrict)
  outcomes           FrameworkOutcome[]

  @@unique([frameworkReleaseId, externalCode])
  @@index([areaId, sortOrder])
  @@map("framework_fields")
}

model FrameworkOutcome {
  id                 String                     @id @default(uuid()) @map("framework_outcome_id")
  frameworkReleaseId String                     @map("framework_release_id")
  fieldId            String                     @map("field_id")
  externalCode       String                     @map("external_code") @db.VarChar(160)
  title              String                     @db.VarChar(1000)
  description        String?                    @db.Text
  nodeGrade          Int?                       @map("node_grade")
  metadata           Json?                      @map("metadata_json")
  sourceAnchor       String?                    @map("source_anchor") @db.VarChar(500)
  checksum           String                     @db.Char(64)
  createdAt          DateTime                   @default(now()) @map("created_at")
  release            CurriculumFrameworkRelease @relation(fields: [frameworkReleaseId], references: [id], onDelete: Restrict)
  field              FrameworkField             @relation(fields: [fieldId], references: [id], onDelete: Restrict)
  aspects            OutcomeAspect[]
  schoolMappings     SchoolOutcomeMapping[]

  @@unique([frameworkReleaseId, externalCode])
  @@index([fieldId])
  @@index([frameworkReleaseId, sourceAnchor])
  @@map("framework_outcomes")
}

model OutcomeAspect {
  id                      String              @id @default(uuid()) @map("outcome_aspect_id")
  frameworkOutcomeId      String              @map("framework_outcome_id")
  code                    String              @db.VarChar(120)
  title                   String              @db.VarChar(500)
  description             String              @db.Text
  requiredForFullCoverage Boolean             @default(true) @map("required_for_full_coverage")
  reviewVersion           Int                 @default(1) @map("review_version")
  status                  OutcomeAspectStatus @default(ACTIVE)
  createdAt               DateTime            @default(now()) @map("created_at")
  updatedAt               DateTime            @updatedAt @map("updated_at")
  frameworkOutcome        FrameworkOutcome    @relation(fields: [frameworkOutcomeId], references: [id], onDelete: Restrict)
  schoolMappings          SchoolOutcomeMapping[]

  @@unique([frameworkOutcomeId, code])
  @@index([frameworkOutcomeId, status])
  @@map("outcome_aspects")
}

model SchoolCurriculumProfile {
  id             String                        @id @default(uuid()) @map("school_curriculum_profile_id")
  organizationId String                        @map("organization_id")
  title          String                        @db.VarChar(255)
  status         SchoolCurriculumProfileStatus @default(ACTIVE)
  createdAt      DateTime                      @default(now()) @map("created_at")
  updatedAt      DateTime                      @updatedAt @map("updated_at")
  deletedAt      DateTime?                     @map("deleted_at")
  organization   Organization                  @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  versions       SchoolCurriculumVersion[]

  @@index([organizationId, status, deletedAt])
  @@map("school_curriculum_profiles")
}

model SchoolCurriculumVersion {
  id                 String                        @id @default(uuid()) @map("school_curriculum_version_id")
  profileId          String                        @map("profile_id")
  versionLabel       String                        @map("version_label") @db.VarChar(160)
  sourceType         SchoolCurriculumSourceType    @map("source_type")
  sourceFileId       String?                       @map("source_file_id") @db.VarChar(255)
  sourceChecksum     String                        @map("source_checksum") @db.Char(64)
  sourceDocumentName String?                       @map("source_document_name") @db.VarChar(500)
  sourceImportedAt   DateTime?                     @map("source_imported_at")
  validFrom          DateTime?                     @map("valid_from")
  validTo            DateTime?                     @map("valid_to")
  status             SchoolCurriculumVersionStatus @default(DRAFT)
  publishedAt        DateTime?                     @map("published_at")
  publishedBy        String?                       @map("published_by")
  createdAt          DateTime                      @default(now()) @map("created_at")
  updatedAt          DateTime                      @updatedAt @map("updated_at")
  deletedAt          DateTime?                     @map("deleted_at")
  profile            SchoolCurriculumProfile       @relation(fields: [profileId], references: [id], onDelete: Restrict)
  subjects           SchoolSubject[]
  outcomes           SchoolOutcome[]
  applicabilities    CurriculumApplicability[]
  mappings           SchoolOutcomeMapping[]        @relation("SchoolOutcomeMappingVersion")

  @@unique([profileId, versionLabel])
  @@unique([profileId, sourceChecksum])
  @@index([profileId, status, deletedAt])
  @@map("school_curriculum_versions")
}

model SchoolSubject {
  id                        String                  @id @default(uuid()) @map("school_subject_id")
  schoolCurriculumVersionId String                  @map("school_curriculum_version_id")
  code                      String?                 @db.VarChar(120)
  title                     String                  @db.VarChar(255)
  shortTitle                String?                 @map("short_title") @db.VarChar(100)
  gradeScope                Json                    @map("grade_scope_json")
  metadata                  Json?                   @map("metadata_json")
  createdAt                 DateTime                @default(now()) @map("created_at")
  schoolCurriculumVersion   SchoolCurriculumVersion @relation(fields: [schoolCurriculumVersionId], references: [id], onDelete: Restrict)
  outcomes                  SchoolOutcome[]

  @@unique([schoolCurriculumVersionId, code])
  @@index([schoolCurriculumVersionId, title])
  @@map("school_subjects")
}

model SchoolOutcome {
  id                        String                  @id @default(uuid()) @map("school_outcome_id")
  schoolCurriculumVersionId String                  @map("school_curriculum_version_id")
  schoolSubjectId           String?                 @map("school_subject_id")
  externalCode              String?                 @map("external_code") @db.VarChar(180)
  title                     String                  @db.VarChar(1200)
  description               String?                 @db.Text
  gradeScope                Json                    @map("grade_scope_json")
  orderIndex                Int?                    @map("order_index")
  metadata                  Json?                   @map("metadata_json")
  sourceAnchor              String?                 @map("source_anchor") @db.VarChar(500)
  checksum                  String                  @db.Char(64)
  createdAt                 DateTime                @default(now()) @map("created_at")
  schoolCurriculumVersion   SchoolCurriculumVersion @relation(fields: [schoolCurriculumVersionId], references: [id], onDelete: Restrict)
  schoolSubject             SchoolSubject?          @relation(fields: [schoolSubjectId], references: [id], onDelete: Restrict)
  mappings                  SchoolOutcomeMapping[]

  @@unique([schoolCurriculumVersionId, externalCode])
  @@index([schoolCurriculumVersionId, schoolSubjectId])
  @@index([checksum])
  @@map("school_outcomes")
}

model CurriculumApplicability {
  id                        String                         @id @default(uuid()) @map("curriculum_applicability_id")
  organizationId            String                         @map("organization_id")
  schoolCurriculumVersionId String                         @map("school_curriculum_version_id")
  frameworkReleaseId        String                         @map("framework_release_id")
  academicYearId            String                         @map("academic_year_id")
  grade                     SchoolGrade?
  classSectionId            String?                        @map("class_section_id")
  validFrom                 DateTime?                      @map("valid_from")
  validTo                   DateTime?                      @map("valid_to")
  priority                  Int                            @default(0)
  status                    CurriculumApplicabilityStatus @default(ACTIVE)
  createdAt                 DateTime                       @default(now()) @map("created_at")
  updatedAt                 DateTime                       @updatedAt @map("updated_at")
  organization              Organization                   @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  schoolCurriculumVersion   SchoolCurriculumVersion        @relation(fields: [schoolCurriculumVersionId], references: [id], onDelete: Restrict)
  frameworkRelease          CurriculumFrameworkRelease     @relation(fields: [frameworkReleaseId], references: [id], onDelete: Restrict)
  academicYear              AcademicYear                   @relation(fields: [academicYearId], references: [id], onDelete: Restrict)
  classSection              ClassSection?                  @relation(fields: [classSectionId], references: [id], onDelete: Restrict)

  @@index([organizationId, academicYearId, status])
  @@index([classSectionId, academicYearId, status])
  @@index([grade, academicYearId, status])
  @@index([schoolCurriculumVersionId])
  @@index([frameworkReleaseId])
  @@map("curriculum_applicabilities")
}

model SchoolOutcomeMapping {
  id                         String                     @id @default(uuid()) @map("school_outcome_mapping_id")
  schoolOutcomeId            String                     @map("school_outcome_id")
  frameworkOutcomeId         String                     @map("framework_outcome_id")
  outcomeAspectId            String?                    @map("outcome_aspect_id")
  mappingType                SchoolOutcomeMappingType   @map("mapping_type")
  confidence                 Float?
  rationale                  String                     @db.Text
  reviewRationale            String?                    @map("review_rationale") @db.Text
  status                     SchoolOutcomeMappingStatus @default(PROPOSED)
  proposedByType             MappingProposerType        @default(HUMAN) @map("proposed_by_type")
  proposedById               String?                    @map("proposed_by_id")
  reviewedBy                 String?                    @map("reviewed_by")
  reviewedAt                 DateTime?                  @map("reviewed_at")
  frameworkReleaseId         String                     @map("framework_release_id")
  schoolCurriculumVersionId  String                     @map("school_curriculum_version_id")
  schoolOutcomeChecksum      String                     @map("school_outcome_checksum") @db.Char(64)
  frameworkOutcomeChecksum   String                     @map("framework_outcome_checksum") @db.Char(64)
  outcomeAspectReviewVersion Int?                       @map("outcome_aspect_review_version")
  createdAt                  DateTime                   @default(now()) @map("created_at")
  updatedAt                  DateTime                   @updatedAt @map("updated_at")
  schoolOutcome              SchoolOutcome              @relation(fields: [schoolOutcomeId], references: [id], onDelete: Restrict)
  frameworkOutcome           FrameworkOutcome           @relation(fields: [frameworkOutcomeId], references: [id], onDelete: Restrict)
  outcomeAspect              OutcomeAspect?             @relation(fields: [outcomeAspectId], references: [id], onDelete: Restrict)
  frameworkRelease           CurriculumFrameworkRelease @relation("SchoolOutcomeMappingRelease", fields: [frameworkReleaseId], references: [id], onDelete: Restrict)
  schoolCurriculumVersion    SchoolCurriculumVersion    @relation("SchoolOutcomeMappingVersion", fields: [schoolCurriculumVersionId], references: [id], onDelete: Restrict)

  @@index([schoolOutcomeId, status])
  @@index([frameworkOutcomeId, status])
  @@index([outcomeAspectId, status])
  @@index([frameworkReleaseId])
  @@index([schoolCurriculumVersionId])
  @@map("school_outcome_mappings")
}

`;

schema = replaceOnce(
  schema,
  'enum SystemRole {',
  `${curriculumSchema}enum SystemRole {`,
  'curriculum model insertion point',
);
fs.writeFileSync(schemaPath, schema);

let appModule = fs.readFileSync(appModulePath, 'utf8');
appModule = replaceOnce(
  appModule,
  "import { ProgressModule } from './progress/progress.module';",
  "import { ProgressModule } from './progress/progress.module';\nimport { CurriculumModule } from './curriculum/curriculum.module';",
  'CurriculumModule import',
);
appModule = replaceOnce(
  appModule,
  '    ProgressModule,\n  ],',
  '    ProgressModule,\n    CurriculumModule,\n  ],',
  'CurriculumModule registration',
);
fs.writeFileSync(appModulePath, appModule);

const sql = String.raw`-- Interactive Curriculum D1 foundation.
-- Additive only. Published/verified curriculum records are historical truth:
-- retire/supersede them; never rewrite or delete them.

CREATE TYPE "CurriculumFrameworkReleaseStatus" AS ENUM ('IMPORTED', 'VERIFIED', 'SUPERSEDED');
CREATE TYPE "OutcomeAspectStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "SchoolCurriculumProfileStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "SchoolCurriculumSourceType" AS ENUM ('UPLOAD', 'MANUAL', 'TEMPLATE', 'IMPORT');
CREATE TYPE "SchoolCurriculumVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED');
CREATE TYPE "CurriculumApplicabilityStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "SchoolOutcomeMappingType" AS ENUM ('EXACT', 'PARTIAL', 'SUPPORTING', 'RELATED');
CREATE TYPE "SchoolOutcomeMappingStatus" AS ENUM ('PROPOSED', 'REVIEWED', 'APPROVED', 'REJECTED', 'STALE');
CREATE TYPE "MappingProposerType" AS ENUM ('HUMAN', 'SYSTEM', 'AI');

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'CURRICULUM';

CREATE TABLE "curriculum_frameworks" (
  "curriculum_framework_id" UUID NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "jurisdiction" VARCHAR(10) NOT NULL,
  "education_type" VARCHAR(100) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "authority_name" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "curriculum_frameworks_pkey" PRIMARY KEY ("curriculum_framework_id")
);

CREATE TABLE "curriculum_framework_releases" (
  "curriculum_framework_release_id" UUID NOT NULL,
  "framework_id" UUID NOT NULL,
  "release_code" VARCHAR(160) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "source_url" TEXT NOT NULL,
  "source_authority" VARCHAR(255) NOT NULL,
  "source_published_at" TIMESTAMP(3),
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source_checksum" CHAR(64) NOT NULL,
  "source_metadata_json" JSONB,
  "status" "CurriculumFrameworkReleaseStatus" NOT NULL DEFAULT 'IMPORTED',
  "verified_at" TIMESTAMP(3),
  "verified_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "curriculum_framework_releases_pkey" PRIMARY KEY ("curriculum_framework_release_id"),
  CONSTRAINT "curriculum_framework_release_window_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "curriculum_framework_release_verify_check" CHECK (
    ("status" = 'IMPORTED' AND "verified_at" IS NULL)
    OR ("status" IN ('VERIFIED', 'SUPERSEDED') AND "verified_at" IS NOT NULL)
  )
);

CREATE TABLE "framework_areas" (
  "framework_area_id" UUID NOT NULL,
  "framework_release_id" UUID NOT NULL,
  "external_code" VARCHAR(160) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "framework_areas_pkey" PRIMARY KEY ("framework_area_id")
);

CREATE TABLE "framework_fields" (
  "framework_field_id" UUID NOT NULL,
  "framework_release_id" UUID NOT NULL,
  "area_id" UUID NOT NULL,
  "external_code" VARCHAR(160) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "framework_fields_pkey" PRIMARY KEY ("framework_field_id")
);

CREATE TABLE "framework_outcomes" (
  "framework_outcome_id" UUID NOT NULL,
  "framework_release_id" UUID NOT NULL,
  "field_id" UUID NOT NULL,
  "external_code" VARCHAR(160) NOT NULL,
  "title" VARCHAR(1000) NOT NULL,
  "description" TEXT,
  "node_grade" INTEGER,
  "metadata_json" JSONB,
  "source_anchor" VARCHAR(500),
  "checksum" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "framework_outcomes_pkey" PRIMARY KEY ("framework_outcome_id"),
  CONSTRAINT "framework_outcomes_node_grade_check" CHECK ("node_grade" IS NULL OR "node_grade" BETWEEN 1 AND 13)
);

CREATE TABLE "outcome_aspects" (
  "outcome_aspect_id" UUID NOT NULL,
  "framework_outcome_id" UUID NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT NOT NULL,
  "required_for_full_coverage" BOOLEAN NOT NULL DEFAULT true,
  "review_version" INTEGER NOT NULL DEFAULT 1,
  "status" "OutcomeAspectStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outcome_aspects_pkey" PRIMARY KEY ("outcome_aspect_id"),
  CONSTRAINT "outcome_aspects_review_version_check" CHECK ("review_version" >= 1)
);

CREATE TABLE "school_curriculum_profiles" (
  "school_curriculum_profile_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "status" "SchoolCurriculumProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "school_curriculum_profiles_pkey" PRIMARY KEY ("school_curriculum_profile_id")
);

CREATE TABLE "school_curriculum_versions" (
  "school_curriculum_version_id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "version_label" VARCHAR(160) NOT NULL,
  "source_type" "SchoolCurriculumSourceType" NOT NULL,
  "source_file_id" VARCHAR(255),
  "source_checksum" CHAR(64) NOT NULL,
  "source_document_name" VARCHAR(500),
  "source_imported_at" TIMESTAMP(3),
  "valid_from" TIMESTAMP(3),
  "valid_to" TIMESTAMP(3),
  "status" "SchoolCurriculumVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "published_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "school_curriculum_versions_pkey" PRIMARY KEY ("school_curriculum_version_id"),
  CONSTRAINT "school_curriculum_version_window_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" >= "valid_from"),
  CONSTRAINT "school_curriculum_version_publish_check" CHECK (
    ("status" IN ('DRAFT', 'REVIEW') AND "published_at" IS NULL)
    OR ("status" IN ('PUBLISHED', 'RETIRED') AND "published_at" IS NOT NULL)
  )
);

CREATE TABLE "school_subjects" (
  "school_subject_id" UUID NOT NULL,
  "school_curriculum_version_id" UUID NOT NULL,
  "code" VARCHAR(120),
  "title" VARCHAR(255) NOT NULL,
  "short_title" VARCHAR(100),
  "grade_scope_json" JSONB NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_subjects_pkey" PRIMARY KEY ("school_subject_id")
);

CREATE TABLE "school_outcomes" (
  "school_outcome_id" UUID NOT NULL,
  "school_curriculum_version_id" UUID NOT NULL,
  "school_subject_id" UUID,
  "external_code" VARCHAR(180),
  "title" VARCHAR(1200) NOT NULL,
  "description" TEXT,
  "grade_scope_json" JSONB NOT NULL,
  "order_index" INTEGER,
  "metadata_json" JSONB,
  "source_anchor" VARCHAR(500),
  "checksum" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_outcomes_pkey" PRIMARY KEY ("school_outcome_id")
);

CREATE TABLE "curriculum_applicabilities" (
  "curriculum_applicability_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "school_curriculum_version_id" UUID NOT NULL,
  "framework_release_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "grade" "SchoolGrade",
  "class_section_id" UUID,
  "valid_from" TIMESTAMP(3),
  "valid_to" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" "CurriculumApplicabilityStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "curriculum_applicabilities_pkey" PRIMARY KEY ("curriculum_applicability_id"),
  CONSTRAINT "curriculum_applicability_scope_check" CHECK (NOT ("grade" IS NOT NULL AND "class_section_id" IS NOT NULL)),
  CONSTRAINT "curriculum_applicability_window_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" >= "valid_from")
);

CREATE TABLE "school_outcome_mappings" (
  "school_outcome_mapping_id" UUID NOT NULL,
  "school_outcome_id" UUID NOT NULL,
  "framework_outcome_id" UUID NOT NULL,
  "outcome_aspect_id" UUID,
  "mapping_type" "SchoolOutcomeMappingType" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "rationale" TEXT NOT NULL,
  "review_rationale" TEXT,
  "status" "SchoolOutcomeMappingStatus" NOT NULL DEFAULT 'PROPOSED',
  "proposed_by_type" "MappingProposerType" NOT NULL DEFAULT 'HUMAN',
  "proposed_by_id" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "framework_release_id" UUID NOT NULL,
  "school_curriculum_version_id" UUID NOT NULL,
  "school_outcome_checksum" CHAR(64) NOT NULL,
  "framework_outcome_checksum" CHAR(64) NOT NULL,
  "outcome_aspect_review_version" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_outcome_mappings_pkey" PRIMARY KEY ("school_outcome_mapping_id"),
  CONSTRAINT "school_outcome_mapping_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  CONSTRAINT "school_outcome_mapping_review_check" CHECK (
    ("status" IN ('PROPOSED', 'STALE') AND "reviewed_at" IS NULL)
    OR ("status" IN ('REVIEWED', 'APPROVED', 'REJECTED') AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "review_rationale" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "curriculum_frameworks_code_key" ON "curriculum_frameworks"("code");
CREATE INDEX "curriculum_frameworks_jurisdiction_education_type_idx" ON "curriculum_frameworks"("jurisdiction", "education_type");
CREATE UNIQUE INDEX "curriculum_framework_releases_framework_id_release_code_key" ON "curriculum_framework_releases"("framework_id", "release_code");
CREATE UNIQUE INDEX "curriculum_framework_releases_framework_id_source_checksum_key" ON "curriculum_framework_releases"("framework_id", "source_checksum");
CREATE INDEX "curriculum_framework_releases_framework_id_status_idx" ON "curriculum_framework_releases"("framework_id", "status");
CREATE INDEX "curriculum_framework_releases_effective_from_effective_to_idx" ON "curriculum_framework_releases"("effective_from", "effective_to");
CREATE UNIQUE INDEX "framework_areas_framework_release_id_external_code_key" ON "framework_areas"("framework_release_id", "external_code");
CREATE INDEX "framework_areas_framework_release_id_sort_order_idx" ON "framework_areas"("framework_release_id", "sort_order");
CREATE UNIQUE INDEX "framework_fields_framework_release_id_external_code_key" ON "framework_fields"("framework_release_id", "external_code");
CREATE INDEX "framework_fields_area_id_sort_order_idx" ON "framework_fields"("area_id", "sort_order");
CREATE UNIQUE INDEX "framework_outcomes_framework_release_id_external_code_key" ON "framework_outcomes"("framework_release_id", "external_code");
CREATE INDEX "framework_outcomes_field_id_idx" ON "framework_outcomes"("field_id");
CREATE INDEX "framework_outcomes_framework_release_id_source_anchor_idx" ON "framework_outcomes"("framework_release_id", "source_anchor");
CREATE UNIQUE INDEX "outcome_aspects_framework_outcome_id_code_key" ON "outcome_aspects"("framework_outcome_id", "code");
CREATE INDEX "outcome_aspects_framework_outcome_id_status_idx" ON "outcome_aspects"("framework_outcome_id", "status");
CREATE INDEX "school_curriculum_profiles_organization_id_status_deleted_at_idx" ON "school_curriculum_profiles"("organization_id", "status", "deleted_at");
CREATE UNIQUE INDEX "school_curriculum_versions_profile_id_version_label_key" ON "school_curriculum_versions"("profile_id", "version_label");
CREATE UNIQUE INDEX "school_curriculum_versions_profile_id_source_checksum_key" ON "school_curriculum_versions"("profile_id", "source_checksum");
CREATE INDEX "school_curriculum_versions_profile_id_status_deleted_at_idx" ON "school_curriculum_versions"("profile_id", "status", "deleted_at");
CREATE UNIQUE INDEX "school_subjects_school_curriculum_version_id_code_key" ON "school_subjects"("school_curriculum_version_id", "code");
CREATE INDEX "school_subjects_school_curriculum_version_id_title_idx" ON "school_subjects"("school_curriculum_version_id", "title");
CREATE UNIQUE INDEX "school_outcomes_school_curriculum_version_id_external_code_key" ON "school_outcomes"("school_curriculum_version_id", "external_code");
CREATE INDEX "school_outcomes_school_curriculum_version_id_school_subject_id_idx" ON "school_outcomes"("school_curriculum_version_id", "school_subject_id");
CREATE INDEX "school_outcomes_checksum_idx" ON "school_outcomes"("checksum");
CREATE INDEX "curriculum_applicabilities_organization_id_academic_year_id_status_idx" ON "curriculum_applicabilities"("organization_id", "academic_year_id", "status");
CREATE INDEX "curriculum_applicabilities_class_section_id_academic_year_id_status_idx" ON "curriculum_applicabilities"("class_section_id", "academic_year_id", "status");
CREATE INDEX "curriculum_applicabilities_grade_academic_year_id_status_idx" ON "curriculum_applicabilities"("grade", "academic_year_id", "status");
CREATE INDEX "curriculum_applicabilities_school_curriculum_version_id_idx" ON "curriculum_applicabilities"("school_curriculum_version_id");
CREATE INDEX "curriculum_applicabilities_framework_release_id_idx" ON "curriculum_applicabilities"("framework_release_id");
CREATE INDEX "school_outcome_mappings_school_outcome_id_status_idx" ON "school_outcome_mappings"("school_outcome_id", "status");
CREATE INDEX "school_outcome_mappings_framework_outcome_id_status_idx" ON "school_outcome_mappings"("framework_outcome_id", "status");
CREATE INDEX "school_outcome_mappings_outcome_aspect_id_status_idx" ON "school_outcome_mappings"("outcome_aspect_id", "status");
CREATE INDEX "school_outcome_mappings_framework_release_id_idx" ON "school_outcome_mappings"("framework_release_id");
CREATE INDEX "school_outcome_mappings_school_curriculum_version_id_idx" ON "school_outcome_mappings"("school_curriculum_version_id");

ALTER TABLE "curriculum_framework_releases" ADD CONSTRAINT "curriculum_framework_releases_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "curriculum_frameworks"("curriculum_framework_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "framework_areas" ADD CONSTRAINT "framework_areas_framework_release_id_fkey" FOREIGN KEY ("framework_release_id") REFERENCES "curriculum_framework_releases"("curriculum_framework_release_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "framework_fields" ADD CONSTRAINT "framework_fields_framework_release_id_fkey" FOREIGN KEY ("framework_release_id") REFERENCES "curriculum_framework_releases"("curriculum_framework_release_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "framework_fields" ADD CONSTRAINT "framework_fields_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "framework_areas"("framework_area_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "framework_outcomes" ADD CONSTRAINT "framework_outcomes_framework_release_id_fkey" FOREIGN KEY ("framework_release_id") REFERENCES "curriculum_framework_releases"("curriculum_framework_release_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "framework_outcomes" ADD CONSTRAINT "framework_outcomes_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "framework_fields"("framework_field_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outcome_aspects" ADD CONSTRAINT "outcome_aspects_framework_outcome_id_fkey" FOREIGN KEY ("framework_outcome_id") REFERENCES "framework_outcomes"("framework_outcome_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_curriculum_profiles" ADD CONSTRAINT "school_curriculum_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_curriculum_versions" ADD CONSTRAINT "school_curriculum_versions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "school_curriculum_profiles"("school_curriculum_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_school_curriculum_version_id_fkey" FOREIGN KEY ("school_curriculum_version_id") REFERENCES "school_curriculum_versions"("school_curriculum_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_outcomes" ADD CONSTRAINT "school_outcomes_school_curriculum_version_id_fkey" FOREIGN KEY ("school_curriculum_version_id") REFERENCES "school_curriculum_versions"("school_curriculum_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_outcomes" ADD CONSTRAINT "school_outcomes_school_subject_id_fkey" FOREIGN KEY ("school_subject_id") REFERENCES "school_subjects"("school_subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_applicabilities" ADD CONSTRAINT "curriculum_applicabilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_applicabilities" ADD CONSTRAINT "curriculum_applicabilities_school_curriculum_version_id_fkey" FOREIGN KEY ("school_curriculum_version_id") REFERENCES "school_curriculum_versions"("school_curriculum_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_applicabilities" ADD CONSTRAINT "curriculum_applicabilities_framework_release_id_fkey" FOREIGN KEY ("framework_release_id") REFERENCES "curriculum_framework_releases"("curriculum_framework_release_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_applicabilities" ADD CONSTRAINT "curriculum_applicabilities_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_applicabilities" ADD CONSTRAINT "curriculum_applicabilities_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("class_section_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_outcome_mappings" ADD CONSTRAINT "school_outcome_mappings_school_outcome_id_fkey" FOREIGN KEY ("school_outcome_id") REFERENCES "school_outcomes"("school_outcome_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_outcome_mappings" ADD CONSTRAINT "school_outcome_mappings_framework_outcome_id_fkey" FOREIGN KEY ("framework_outcome_id") REFERENCES "framework_outcomes"("framework_outcome_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_outcome_mappings" ADD CONSTRAINT "school_outcome_mappings_outcome_aspect_id_fkey" FOREIGN KEY ("outcome_aspect_id") REFERENCES "outcome_aspects"("outcome_aspect_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_outcome_mappings" ADD CONSTRAINT "school_outcome_mappings_framework_release_id_fkey" FOREIGN KEY ("framework_release_id") REFERENCES "curriculum_framework_releases"("curriculum_framework_release_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_outcome_mappings" ADD CONSTRAINT "school_outcome_mappings_school_curriculum_version_id_fkey" FOREIGN KEY ("school_curriculum_version_id") REFERENCES "school_curriculum_versions"("school_curriculum_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A field cannot point at an area from another release; an outcome cannot point
-- at a field from another release. Prisma relations alone do not express this
-- redundant release invariant, so enforce it here.
CREATE OR REPLACE FUNCTION curriculum_framework_structure_consistency() RETURNS TRIGGER AS $$
DECLARE parent_release UUID;
BEGIN
  IF TG_TABLE_NAME = 'framework_fields' THEN
    SELECT "framework_release_id" INTO parent_release FROM "framework_areas" WHERE "framework_area_id" = NEW."area_id";
  ELSE
    SELECT "framework_release_id" INTO parent_release FROM "framework_fields" WHERE "framework_field_id" = NEW."field_id";
  END IF;
  IF parent_release IS NULL OR parent_release <> NEW."framework_release_id" THEN
    RAISE EXCEPTION 'CURRICULUM_FRAMEWORK_RELEASE_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER curriculum_framework_field_consistency BEFORE INSERT OR UPDATE ON "framework_fields" FOR EACH ROW EXECUTE FUNCTION curriculum_framework_structure_consistency();
CREATE TRIGGER curriculum_framework_outcome_consistency BEFORE INSERT OR UPDATE ON "framework_outcomes" FOR EACH ROW EXECUTE FUNCTION curriculum_framework_structure_consistency();

-- VERIFIED/SUPERSEDED official snapshots are immutable. The only legal state
-- transition after verification is VERIFIED -> SUPERSEDED.
CREATE OR REPLACE FUNCTION curriculum_framework_release_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('VERIFIED', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'CURRICULUM_FRAMEWORK_RELEASE_IMMUTABLE';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" IN ('VERIFIED', 'SUPERSEDED') THEN
    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'CURRICULUM_FRAMEWORK_RELEASE_IMMUTABLE';
    END IF;
    IF OLD."status" = 'SUPERSEDED' OR NEW."status" NOT IN ('VERIFIED', 'SUPERSEDED') THEN
      RAISE EXCEPTION 'CURRICULUM_FRAMEWORK_RELEASE_IMMUTABLE';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER curriculum_framework_release_immutable_trigger BEFORE UPDATE OR DELETE ON "curriculum_framework_releases" FOR EACH ROW EXECUTE FUNCTION curriculum_framework_release_immutable();

CREATE OR REPLACE FUNCTION curriculum_framework_child_immutable() RETURNS TRIGGER AS $$
DECLARE old_release UUID;
DECLARE new_release UUID;
DECLARE immutable_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'framework_areas' THEN
    old_release := CASE WHEN TG_OP <> 'INSERT' THEN OLD."framework_release_id" ELSE NULL END;
    new_release := CASE WHEN TG_OP <> 'DELETE' THEN NEW."framework_release_id" ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'framework_fields' THEN
    old_release := CASE WHEN TG_OP <> 'INSERT' THEN OLD."framework_release_id" ELSE NULL END;
    new_release := CASE WHEN TG_OP <> 'DELETE' THEN NEW."framework_release_id" ELSE NULL END;
  ELSE
    old_release := CASE WHEN TG_OP <> 'INSERT' THEN OLD."framework_release_id" ELSE NULL END;
    new_release := CASE WHEN TG_OP <> 'DELETE' THEN NEW."framework_release_id" ELSE NULL END;
  END IF;
  SELECT COUNT(*) INTO immutable_count
  FROM "curriculum_framework_releases"
  WHERE "curriculum_framework_release_id" IN (old_release, new_release)
    AND "status" IN ('VERIFIED', 'SUPERSEDED');
  IF immutable_count > 0 THEN
    RAISE EXCEPTION 'CURRICULUM_FRAMEWORK_RELEASE_IMMUTABLE';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER framework_areas_immutable_trigger BEFORE INSERT OR UPDATE OR DELETE ON "framework_areas" FOR EACH ROW EXECUTE FUNCTION curriculum_framework_child_immutable();
CREATE TRIGGER framework_fields_immutable_trigger BEFORE INSERT OR UPDATE OR DELETE ON "framework_fields" FOR EACH ROW EXECUTE FUNCTION curriculum_framework_child_immutable();
CREATE TRIGGER framework_outcomes_immutable_trigger BEFORE INSERT OR UPDATE OR DELETE ON "framework_outcomes" FOR EACH ROW EXECUTE FUNCTION curriculum_framework_child_immutable();

-- Published ŠVP snapshots are immutable; retirement is a status transition,
-- not an edit. Draft/review snapshots remain authorable.
CREATE OR REPLACE FUNCTION school_curriculum_version_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'SCHOOL_CURRICULUM_VERSION_IMMUTABLE';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" IN ('PUBLISHED', 'RETIRED') THEN
    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'SCHOOL_CURRICULUM_VERSION_IMMUTABLE';
    END IF;
    IF OLD."status" = 'RETIRED' OR NEW."status" NOT IN ('PUBLISHED', 'RETIRED') THEN
      RAISE EXCEPTION 'SCHOOL_CURRICULUM_VERSION_IMMUTABLE';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER school_curriculum_version_immutable_trigger BEFORE UPDATE OR DELETE ON "school_curriculum_versions" FOR EACH ROW EXECUTE FUNCTION school_curriculum_version_immutable();

CREATE OR REPLACE FUNCTION school_curriculum_child_immutable() RETURNS TRIGGER AS $$
DECLARE old_version UUID;
DECLARE new_version UUID;
DECLARE immutable_count INTEGER;
BEGIN
  old_version := CASE WHEN TG_OP <> 'INSERT' THEN OLD."school_curriculum_version_id" ELSE NULL END;
  new_version := CASE WHEN TG_OP <> 'DELETE' THEN NEW."school_curriculum_version_id" ELSE NULL END;
  SELECT COUNT(*) INTO immutable_count
  FROM "school_curriculum_versions"
  WHERE "school_curriculum_version_id" IN (old_version, new_version)
    AND "status" IN ('PUBLISHED', 'RETIRED');
  IF immutable_count > 0 THEN
    RAISE EXCEPTION 'SCHOOL_CURRICULUM_VERSION_IMMUTABLE';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER school_subjects_immutable_trigger BEFORE INSERT OR UPDATE OR DELETE ON "school_subjects" FOR EACH ROW EXECUTE FUNCTION school_curriculum_child_immutable();
CREATE TRIGGER school_outcomes_immutable_trigger BEFORE INSERT OR UPDATE OR DELETE ON "school_outcomes" FOR EACH ROW EXECUTE FUNCTION school_curriculum_child_immutable();

CREATE OR REPLACE FUNCTION school_outcome_subject_consistency() RETURNS TRIGGER AS $$
DECLARE subject_version UUID;
BEGIN
  IF NEW."school_subject_id" IS NULL THEN RETURN NEW; END IF;
  SELECT "school_curriculum_version_id" INTO subject_version
  FROM "school_subjects" WHERE "school_subject_id" = NEW."school_subject_id";
  IF subject_version IS NULL OR subject_version <> NEW."school_curriculum_version_id" THEN
    RAISE EXCEPTION 'SCHOOL_OUTCOME_SUBJECT_VERSION_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER school_outcome_subject_consistency_trigger BEFORE INSERT OR UPDATE ON "school_outcomes" FOR EACH ROW EXECUTE FUNCTION school_outcome_subject_consistency();

-- Tenant/year/class consistency for applicability. Historical ACTIVE rows may
-- continue referencing a later SUPERSEDED release, but creation/edit of ACTIVE
-- rules requires a currently VERIFIED release and PUBLISHED school version.
CREATE OR REPLACE FUNCTION curriculum_applicability_consistency() RETURNS TRIGGER AS $$
DECLARE profile_org UUID;
DECLARE school_status "SchoolCurriculumVersionStatus";
DECLARE release_status "CurriculumFrameworkReleaseStatus";
DECLARE year_org UUID;
DECLARE class_org UUID;
DECLARE class_year UUID;
BEGIN
  SELECT p."organization_id", v."status" INTO profile_org, school_status
  FROM "school_curriculum_versions" v
  JOIN "school_curriculum_profiles" p ON p."school_curriculum_profile_id" = v."profile_id"
  WHERE v."school_curriculum_version_id" = NEW."school_curriculum_version_id";
  IF profile_org IS NULL OR profile_org <> NEW."organization_id" THEN
    RAISE EXCEPTION 'CURRICULUM_APPLICABILITY_TENANT_MISMATCH';
  END IF;
  SELECT "status" INTO release_status FROM "curriculum_framework_releases" WHERE "curriculum_framework_release_id" = NEW."framework_release_id";
  SELECT "organization_id" INTO year_org FROM "academic_years" WHERE "academic_year_id" = NEW."academic_year_id";
  IF year_org IS NULL OR year_org <> NEW."organization_id" THEN
    RAISE EXCEPTION 'CURRICULUM_APPLICABILITY_YEAR_TENANT_MISMATCH';
  END IF;
  IF NEW."class_section_id" IS NOT NULL THEN
    SELECT "organization_id", "academic_year_id" INTO class_org, class_year FROM "class_sections" WHERE "class_section_id" = NEW."class_section_id";
    IF class_org IS NULL OR class_org <> NEW."organization_id" OR class_year <> NEW."academic_year_id" THEN
      RAISE EXCEPTION 'CURRICULUM_APPLICABILITY_CLASS_SCOPE_MISMATCH';
    END IF;
  END IF;
  IF NEW."status" = 'ACTIVE' AND (TG_OP = 'INSERT' OR OLD."status" <> NEW."status" OR OLD."school_curriculum_version_id" <> NEW."school_curriculum_version_id" OR OLD."framework_release_id" <> NEW."framework_release_id") THEN
    IF school_status <> 'PUBLISHED' THEN RAISE EXCEPTION 'CURRICULUM_APPLICABILITY_VERSION_NOT_PUBLISHED'; END IF;
    IF release_status <> 'VERIFIED' THEN RAISE EXCEPTION 'CURRICULUM_APPLICABILITY_RELEASE_NOT_VERIFIED'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER curriculum_applicability_consistency_trigger BEFORE INSERT OR UPDATE ON "curriculum_applicabilities" FOR EACH ROW EXECUTE FUNCTION curriculum_applicability_consistency();

-- Exact equal-rank duplicates are rejected at DB level too. Different priority
-- values are intentional because the deterministic resolver can rank them.
CREATE UNIQUE INDEX "curriculum_applicability_active_class_rank_key"
  ON "curriculum_applicabilities"("organization_id", "academic_year_id", "class_section_id", "priority")
  WHERE "status" = 'ACTIVE' AND "class_section_id" IS NOT NULL;
CREATE UNIQUE INDEX "curriculum_applicability_active_grade_rank_key"
  ON "curriculum_applicabilities"("organization_id", "academic_year_id", "grade", "priority")
  WHERE "status" = 'ACTIVE' AND "class_section_id" IS NULL AND "grade" IS NOT NULL;
CREATE UNIQUE INDEX "curriculum_applicability_active_default_rank_key"
  ON "curriculum_applicabilities"("organization_id", "academic_year_id", "priority")
  WHERE "status" = 'ACTIVE' AND "class_section_id" IS NULL AND "grade" IS NULL;

CREATE OR REPLACE FUNCTION school_outcome_mapping_consistency() RETURNS TRIGGER AS $$
DECLARE school_version UUID;
DECLARE school_checksum CHAR(64);
DECLARE school_status "SchoolCurriculumVersionStatus";
DECLARE framework_release UUID;
DECLARE framework_checksum CHAR(64);
DECLARE framework_status "CurriculumFrameworkReleaseStatus";
DECLARE aspect_outcome UUID;
DECLARE aspect_review INTEGER;
BEGIN
  SELECT so."school_curriculum_version_id", so."checksum", v."status"
    INTO school_version, school_checksum, school_status
  FROM "school_outcomes" so
  JOIN "school_curriculum_versions" v ON v."school_curriculum_version_id" = so."school_curriculum_version_id"
  WHERE so."school_outcome_id" = NEW."school_outcome_id";

  SELECT fo."framework_release_id", fo."checksum", r."status"
    INTO framework_release, framework_checksum, framework_status
  FROM "framework_outcomes" fo
  JOIN "curriculum_framework_releases" r ON r."curriculum_framework_release_id" = fo."framework_release_id"
  WHERE fo."framework_outcome_id" = NEW."framework_outcome_id";

  IF school_version IS NULL OR school_version <> NEW."school_curriculum_version_id" THEN
    RAISE EXCEPTION 'CURRICULUM_MAPPING_SCHOOL_VERSION_MISMATCH';
  END IF;
  IF framework_release IS NULL OR framework_release <> NEW."framework_release_id" THEN
    RAISE EXCEPTION 'CURRICULUM_MAPPING_FRAMEWORK_RELEASE_MISMATCH';
  END IF;
  IF NEW."outcome_aspect_id" IS NOT NULL THEN
    SELECT "framework_outcome_id", "review_version" INTO aspect_outcome, aspect_review
    FROM "outcome_aspects" WHERE "outcome_aspect_id" = NEW."outcome_aspect_id";
    IF aspect_outcome IS NULL OR aspect_outcome <> NEW."framework_outcome_id" THEN
      RAISE EXCEPTION 'CURRICULUM_MAPPING_ASPECT_OUTCOME_MISMATCH';
    END IF;
  ELSE
    aspect_review := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF school_status <> 'PUBLISHED' THEN RAISE EXCEPTION 'CURRICULUM_MAPPING_SCHOOL_VERSION_NOT_PUBLISHED'; END IF;
    IF framework_status <> 'VERIFIED' THEN RAISE EXCEPTION 'CURRICULUM_MAPPING_FRAMEWORK_RELEASE_NOT_VERIFIED'; END IF;
    IF NEW."school_outcome_checksum" <> school_checksum OR NEW."framework_outcome_checksum" <> framework_checksum OR NEW."outcome_aspect_review_version" IS DISTINCT FROM aspect_review THEN
      RAISE EXCEPTION 'CURRICULUM_MAPPING_PROVENANCE_MISMATCH';
    END IF;
  ELSIF NEW."status" <> 'STALE' THEN
    IF NEW."school_outcome_checksum" <> school_checksum OR NEW."framework_outcome_checksum" <> framework_checksum OR NEW."outcome_aspect_review_version" IS DISTINCT FROM aspect_review THEN
      RAISE EXCEPTION 'CURRICULUM_MAPPING_STALE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER school_outcome_mapping_consistency_trigger BEFORE INSERT OR UPDATE ON "school_outcome_mappings" FOR EACH ROW EXECUTE FUNCTION school_outcome_mapping_consistency();

CREATE OR REPLACE FUNCTION school_outcome_mapping_history_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'CURRICULUM_MAPPING_HISTORY_IMMUTABLE'; END IF;
  IF OLD."status" IN ('REJECTED', 'STALE') THEN RAISE EXCEPTION 'CURRICULUM_MAPPING_HISTORY_IMMUTABLE'; END IF;
  IF OLD."status" = 'APPROVED' AND NEW."status" NOT IN ('APPROVED', 'STALE') THEN
    RAISE EXCEPTION 'CURRICULUM_MAPPING_APPROVAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER school_outcome_mapping_history_guard_trigger BEFORE UPDATE OR DELETE ON "school_outcome_mappings" FOR EACH ROW EXECUTE FUNCTION school_outcome_mapping_history_guard();
`;

fs.mkdirSync(migrationDir, { recursive: true });
if (fs.existsSync(migrationPath)) {
  throw new Error('Curriculum D1 migration already exists; refusing overwrite.');
}
fs.writeFileSync(migrationPath, sql);

// This bootstrap is intentionally one-shot. The resulting branch contains only
// production schema/module/migration changes; no persistent privileged helper.
if (fs.existsSync(selfPath)) fs.rmSync(selfPath);
if (fs.existsSync(workflowPath)) fs.rmSync(workflowPath);

console.log('Curriculum D1 schema bootstrap applied and bootstrap files removed.');
