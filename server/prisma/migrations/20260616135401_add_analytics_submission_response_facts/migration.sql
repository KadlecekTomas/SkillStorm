-- CreateEnum
CREATE TYPE "public"."AnalyticsDataQuality" AS ENUM ('COMPLETE', 'PARTIAL', 'LEGACY_INFERRED', 'BROKEN_REFERENCE');

-- CreateEnum
CREATE TYPE "public"."AnalyticsSnapshotSource" AS ENUM ('LIVE_SUBMIT', 'BACKFILL');

-- CreateTable
CREATE TABLE "public"."submission_facts" (
    "submission_fact_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "test_version" INTEGER NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "student_id" TEXT,
    "academic_year_id" TEXT,
    "class_section_id" TEXT,
    "subject_id" TEXT,
    "catalog_subject_id" TEXT,
    "topic_level_id" TEXT,
    "catalog_topic_id" TEXT,
    "attempt_no" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "question_count" INTEGER NOT NULL,
    "correct_count" INTEGER NOT NULL,
    "incorrect_count" INTEGER NOT NULL,
    "unanswered_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "duration_sec" INTEGER,
    "data_quality" "public"."AnalyticsDataQuality" NOT NULL DEFAULT 'COMPLETE',
    "source" "public"."AnalyticsSnapshotSource" NOT NULL DEFAULT 'LIVE_SUBMIT',
    "snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_facts_pkey" PRIMARY KEY ("submission_fact_id")
);

-- CreateTable
CREATE TABLE "public"."response_facts" (
    "response_fact_id" TEXT NOT NULL,
    "submission_fact_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "student_id" TEXT,
    "academic_year_id" TEXT,
    "question_id" TEXT NOT NULL,
    "question_order" INTEGER,
    "question_type" "public"."QuestionType" NOT NULL,
    "question_text_snapshot" TEXT,
    "topic_level_id" TEXT,
    "catalog_topic_id" TEXT,
    "subject_id" TEXT,
    "difficulty" "public"."Difficulty",
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "is_correct" BOOLEAN,
    "corrected" BOOLEAN NOT NULL DEFAULT false,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "given_text_snapshot" TEXT,
    "data_quality" "public"."AnalyticsDataQuality" NOT NULL DEFAULT 'COMPLETE',
    "snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "response_time_sec" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_facts_pkey" PRIMARY KEY ("response_fact_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_facts_submission_id_key" ON "public"."submission_facts"("submission_id");

-- CreateIndex
CREATE INDEX "submission_facts_organization_id_user_id_submitted_at_idx" ON "public"."submission_facts"("organization_id", "user_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submission_facts_user_id_submitted_at_idx" ON "public"."submission_facts"("user_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submission_facts_membership_id_submitted_at_idx" ON "public"."submission_facts"("membership_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submission_facts_student_id_submitted_at_idx" ON "public"."submission_facts"("student_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submission_facts_academic_year_id_submitted_at_idx" ON "public"."submission_facts"("academic_year_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submission_facts_subject_id_submitted_at_idx" ON "public"."submission_facts"("subject_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submission_facts_catalog_subject_id_submitted_at_idx" ON "public"."submission_facts"("catalog_subject_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submission_facts_topic_level_id_submitted_at_idx" ON "public"."submission_facts"("topic_level_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submission_facts_catalog_topic_id_submitted_at_idx" ON "public"."submission_facts"("catalog_topic_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "response_facts_response_id_key" ON "public"."response_facts"("response_id");

-- CreateIndex
CREATE INDEX "response_facts_submission_fact_id_idx" ON "public"."response_facts"("submission_fact_id");

-- AddForeignKey
ALTER TABLE "public"."response_facts" ADD CONSTRAINT "response_facts_submission_fact_id_fkey" FOREIGN KEY ("submission_fact_id") REFERENCES "public"."submission_facts"("submission_fact_id") ON DELETE CASCADE ON UPDATE CASCADE;
