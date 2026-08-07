-- SkillStorm school progress tracking
-- Additive migration: no existing table or column is removed.

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'PROGRESS';

DO $$ BEGIN
  CREATE TYPE "ProgressEntryType" AS ENUM ('ASSESSMENT', 'COMMENT', 'PRAISE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED', 'LATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InterventionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "competencies" (
  "competency_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "subject_id" TEXT,
  "name" VARCHAR(180) NOT NULL,
  "description" VARCHAR(1000),
  "scale_min" INTEGER NOT NULL DEFAULT 1,
  "scale_max" INTEGER NOT NULL DEFAULT 4,
  "sort_order" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "competencies_pkey" PRIMARY KEY ("competency_id"),
  CONSTRAINT "competencies_scale_check" CHECK ("scale_min" >= 1 AND "scale_max" >= "scale_min" AND "scale_max" <= 10),
  CONSTRAINT "competencies_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "competencies_subject_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "competencies_org_subject_idx" ON "competencies"("organization_id", "subject_id");
CREATE INDEX IF NOT EXISTS "competencies_org_active_idx" ON "competencies"("organization_id", "is_active", "deleted_at");
CREATE UNIQUE INDEX IF NOT EXISTS "competencies_org_subject_name_unique" ON "competencies"("organization_id", "subject_id", "name") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "student_progress_entries" (
  "progress_entry_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "class_section_id" TEXT NOT NULL,
  "subject_id" TEXT,
  "competency_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "entry_type" "ProgressEntryType" NOT NULL DEFAULT 'ASSESSMENT',
  "grade_value" INTEGER,
  "competency_level" INTEGER,
  "comment" VARCHAR(2000),
  "client_mutation_id" VARCHAR(64),
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "student_progress_entries_pkey" PRIMARY KEY ("progress_entry_id"),
  CONSTRAINT "student_progress_grade_check" CHECK ("grade_value" IS NULL OR ("grade_value" BETWEEN 1 AND 5)),
  CONSTRAINT "student_progress_competency_check" CHECK ("competency_level" IS NULL OR ("competency_level" BETWEEN 1 AND 10)),
  CONSTRAINT "student_progress_has_value_check" CHECK ("grade_value" IS NOT NULL OR "competency_level" IS NOT NULL OR NULLIF(BTRIM("comment"), '') IS NOT NULL),
  CONSTRAINT "student_progress_student_org_fkey" FOREIGN KEY ("student_id", "organization_id") REFERENCES "students"("student_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "student_progress_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "student_progress_class_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("class_section_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "student_progress_subject_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "student_progress_competency_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("competency_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "student_progress_author_fkey" FOREIGN KEY ("created_by_id") REFERENCES "memberships"("membership_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "student_progress_student_time_idx" ON "student_progress_entries"("student_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "student_progress_org_year_idx" ON "student_progress_entries"("organization_id", "academic_year_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "student_progress_class_time_idx" ON "student_progress_entries"("class_section_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "student_progress_subject_time_idx" ON "student_progress_entries"("subject_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "student_progress_competency_time_idx" ON "student_progress_entries"("competency_id", "occurred_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "student_progress_client_mutation_unique" ON "student_progress_entries"("organization_id", "created_by_id", "client_mutation_id") WHERE "client_mutation_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "attendance_records" (
  "attendance_record_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "class_section_id" TEXT NOT NULL,
  "subject_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "minutes_late" INTEGER,
  "note" VARCHAR(1000),
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("attendance_record_id"),
  CONSTRAINT "attendance_minutes_late_check" CHECK ("minutes_late" IS NULL OR "minutes_late" >= 0),
  CONSTRAINT "attendance_student_org_fkey" FOREIGN KEY ("student_id", "organization_id") REFERENCES "students"("student_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_class_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("class_section_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_subject_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "attendance_author_fkey" FOREIGN KEY ("created_by_id") REFERENCES "memberships"("membership_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "attendance_student_time_idx" ON "attendance_records"("student_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "attendance_class_time_idx" ON "attendance_records"("class_section_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "attendance_org_year_idx" ON "attendance_records"("organization_id", "academic_year_id", "occurred_at" DESC);

CREATE TABLE IF NOT EXISTS "student_interventions" (
  "intervention_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "class_section_id" TEXT NOT NULL,
  "subject_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "note" VARCHAR(3000),
  "status" "InterventionStatus" NOT NULL DEFAULT 'OPEN',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "student_interventions_pkey" PRIMARY KEY ("intervention_id"),
  CONSTRAINT "interventions_student_org_fkey" FOREIGN KEY ("student_id", "organization_id") REFERENCES "students"("student_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "interventions_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "interventions_class_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("class_section_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "interventions_subject_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "interventions_author_fkey" FOREIGN KEY ("created_by_id") REFERENCES "memberships"("membership_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "interventions_student_status_idx" ON "student_interventions"("student_id", "status", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "interventions_class_status_idx" ON "student_interventions"("class_section_id", "status", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "interventions_org_status_idx" ON "student_interventions"("organization_id", "status", "started_at" DESC);
