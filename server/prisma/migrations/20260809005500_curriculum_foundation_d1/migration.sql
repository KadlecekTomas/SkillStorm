-- Interactive Curriculum D1 foundation.
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
  "curriculum_framework_id" TEXT NOT NULL,
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
  "curriculum_framework_release_id" TEXT NOT NULL,
  "framework_id" TEXT NOT NULL,
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
  "framework_area_id" TEXT NOT NULL,
  "framework_release_id" TEXT NOT NULL,
  "external_code" VARCHAR(160) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "framework_areas_pkey" PRIMARY KEY ("framework_area_id")
);

CREATE TABLE "framework_fields" (
  "framework_field_id" TEXT NOT NULL,
  "framework_release_id" TEXT NOT NULL,
  "area_id" TEXT NOT NULL,
  "external_code" VARCHAR(160) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "framework_fields_pkey" PRIMARY KEY ("framework_field_id")
);

CREATE TABLE "framework_outcomes" (
  "framework_outcome_id" TEXT NOT NULL,
  "framework_release_id" TEXT NOT NULL,
  "field_id" TEXT NOT NULL,
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
  "outcome_aspect_id" TEXT NOT NULL,
  "framework_outcome_id" TEXT NOT NULL,
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
  "school_curriculum_profile_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "status" "SchoolCurriculumProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "school_curriculum_profiles_pkey" PRIMARY KEY ("school_curriculum_profile_id")
);

CREATE TABLE "school_curriculum_versions" (
  "school_curriculum_version_id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
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
  "school_subject_id" TEXT NOT NULL,
  "school_curriculum_version_id" TEXT NOT NULL,
  "code" VARCHAR(120),
  "title" VARCHAR(255) NOT NULL,
  "short_title" VARCHAR(100),
  "grade_scope_json" JSONB NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_subjects_pkey" PRIMARY KEY ("school_subject_id")
);

CREATE TABLE "school_outcomes" (
  "school_outcome_id" TEXT NOT NULL,
  "school_curriculum_version_id" TEXT NOT NULL,
  "school_subject_id" TEXT,
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
  "curriculum_applicability_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "school_curriculum_version_id" TEXT NOT NULL,
  "framework_release_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "grade" "SchoolGrade",
  "class_section_id" TEXT,
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
  "school_outcome_mapping_id" TEXT NOT NULL,
  "school_outcome_id" TEXT NOT NULL,
  "framework_outcome_id" TEXT NOT NULL,
  "outcome_aspect_id" TEXT,
  "mapping_type" "SchoolOutcomeMappingType" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "rationale" TEXT NOT NULL,
  "review_rationale" TEXT,
  "status" "SchoolOutcomeMappingStatus" NOT NULL DEFAULT 'PROPOSED',
  "proposed_by_type" "MappingProposerType" NOT NULL DEFAULT 'HUMAN',
  "proposed_by_id" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "framework_release_id" TEXT NOT NULL,
  "school_curriculum_version_id" TEXT NOT NULL,
  "school_outcome_checksum" CHAR(64) NOT NULL,
  "framework_outcome_checksum" CHAR(64) NOT NULL,
  "outcome_aspect_review_version" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_outcome_mappings_pkey" PRIMARY KEY ("school_outcome_mapping_id"),
  CONSTRAINT "school_outcome_mapping_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  CONSTRAINT "school_outcome_mapping_review_check" CHECK (
    ("status" = 'PROPOSED' AND "reviewed_at" IS NULL)
    OR ("status" IN ('REVIEWED', 'APPROVED', 'REJECTED') AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "review_rationale" IS NOT NULL)
    OR "status" = 'STALE'
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
DECLARE parent_release TEXT;
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
DECLARE old_release TEXT;
DECLARE new_release TEXT;
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

-- Outcome aspects are SkillStorm's internal review layer and may evolve after
-- an official framework release is verified. Any semantic edit must bump the
-- review version so every approved mapping can be deterministically marked stale.
CREATE OR REPLACE FUNCTION outcome_aspect_review_version_guard() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."review_version" < OLD."review_version" THEN
    RAISE EXCEPTION 'OUTCOME_ASPECT_REVIEW_VERSION_DECREASE';
  END IF;
  IF (NEW."title", NEW."description", NEW."required_for_full_coverage", NEW."status")
      IS DISTINCT FROM
     (OLD."title", OLD."description", OLD."required_for_full_coverage", OLD."status")
     AND NEW."review_version" <= OLD."review_version" THEN
    RAISE EXCEPTION 'OUTCOME_ASPECT_REVIEW_VERSION_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER outcome_aspect_review_version_guard_trigger BEFORE UPDATE ON "outcome_aspects" FOR EACH ROW EXECUTE FUNCTION outcome_aspect_review_version_guard();

-- Published ŠVP snapshots are immutable; retirement is a status transition,
-- not an edit. Draft/review snapshots remain authorable.
CREATE OR REPLACE FUNCTION school_curriculum_version_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'SCHOOL_CURRICULUM_VERSION_IMMUTABLE';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" IN ('PUBLISHED', 'RETIRED') THEN
    IF (to_jsonb(NEW) - ARRAY['status', 'updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
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
DECLARE old_version TEXT;
DECLARE new_version TEXT;
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
DECLARE subject_version TEXT;
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
DECLARE profile_org TEXT;
DECLARE school_status "SchoolCurriculumVersionStatus";
DECLARE release_status "CurriculumFrameworkReleaseStatus";
DECLARE year_org TEXT;
DECLARE class_org TEXT;
DECLARE class_year TEXT;
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
DECLARE school_version TEXT;
DECLARE school_checksum CHAR(64);
DECLARE school_status "SchoolCurriculumVersionStatus";
DECLARE framework_release TEXT;
DECLARE framework_checksum CHAR(64);
DECLARE framework_status "CurriculumFrameworkReleaseStatus";
DECLARE aspect_outcome TEXT;
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
  IF OLD."status" = 'APPROVED' THEN
    IF NEW."status" <> 'STALE' THEN
      RAISE EXCEPTION 'CURRICULUM_MAPPING_APPROVAL_IMMUTABLE';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['status', 'updated_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
      RAISE EXCEPTION 'CURRICULUM_MAPPING_APPROVAL_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER school_outcome_mapping_history_guard_trigger BEFORE UPDATE OR DELETE ON "school_outcome_mappings" FOR EACH ROW EXECUTE FUNCTION school_outcome_mapping_history_guard();
