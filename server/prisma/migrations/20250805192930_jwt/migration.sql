-- CreateEnum
CREATE TYPE "public"."SystemRole" AS ENUM ('SUPERADMIN');

-- CreateEnum
CREATE TYPE "public"."OrganizationRole" AS ENUM ('STUDENT', 'TEACHER', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "public"."PermissionKey" AS ENUM ('CREATE_TEST', 'EDIT_TEST', 'DELETE_TEST', 'VIEW_RESULTS', 'MANAGE_STUDENTS', 'MANAGE_TEACHERS');

-- CreateEnum
CREATE TYPE "public"."QuestionType" AS ENUM ('FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "public"."SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."EducationLevel" AS ENUM ('PRIMARY_1', 'PRIMARY_2', 'SECONDARY_MATURITA', 'SECONDARY_VOCATIONAL');

-- CreateEnum
CREATE TYPE "public"."SchoolGrade" AS ENUM ('GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9', 'HIGH_SCHOOL_YEAR_1', 'HIGH_SCHOOL_YEAR_2', 'HIGH_SCHOOL_YEAR_3', 'HIGH_SCHOOL_YEAR_4');

-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('MATERIAL', 'PRACTICE', 'TEST', 'VIDEO', 'LINK');

-- CreateEnum
CREATE TYPE "public"."ContentScope" AS ENUM ('GLOBAL', 'ORGANIZATION', 'SHARED');

-- CreateEnum
CREATE TYPE "public"."OrganizationType" AS ENUM ('SCHOOL', 'PRIVATE', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "public"."PlanTarget" AS ENUM ('SCHOOL', 'PRIVATE', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "public"."AuditEntityType" AS ENUM ('USER', 'ORGANIZATION', 'CLASSROOM', 'TEST', 'LEARNING_MATERIAL', 'PERMISSION');

-- CreateTable
CREATE TABLE "public"."users" (
    "user_id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "preferred_lang" VARCHAR(10),
    "system_role" "public"."SystemRole",
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."organizations" (
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255),
    "city" VARCHAR(100),
    "country" VARCHAR(100),
    "type" "public"."OrganizationType" NOT NULL DEFAULT 'SCHOOL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "public"."memberships" (
    "membership_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "public"."OrganizationRole" NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "avatar_type" VARCHAR(50),
    "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "permission_id" TEXT NOT NULL,
    "key" "public"."PermissionKey" NOT NULL,
    "description" TEXT,
    "allowedTypes" "public"."OrganizationType"[],

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "role_permission_id" TEXT NOT NULL,
    "role" "public"."OrganizationRole" NOT NULL,
    "permission_id" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_permission_id")
);

-- CreateTable
CREATE TABLE "public"."user_permissions" (
    "user_permission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_permission_id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "subscription_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("subscription_id")
);

-- CreateTable
CREATE TABLE "public"."subscription_plans" (
    "plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" "public"."PlanTarget" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "billing_cycle" VARCHAR(50) NOT NULL,
    "max_users" INTEGER,
    "features" JSONB NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("plan_id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "refresh_token_id" TEXT NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("refresh_token_id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "audit_log_id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "entity_type" "public"."AuditEntityType" NOT NULL,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "changed_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_log_id")
);

-- CreateTable
CREATE TABLE "public"."classrooms" (
    "classroom_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "grade" "public"."SchoolGrade" NOT NULL,
    "study_field" TEXT,
    "teacher_id" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("classroom_id")
);

-- CreateTable
CREATE TABLE "public"."teachers" (
    "teacher_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("teacher_id")
);

-- CreateTable
CREATE TABLE "public"."students" (
    "student_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "organization_id" TEXT NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "public"."subjects" (
    "subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("subject_id")
);

-- CreateTable
CREATE TABLE "public"."topics" (
    "topic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("topic_id")
);

-- CreateTable
CREATE TABLE "public"."teacher_subjects" (
    "teacher_subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,

    CONSTRAINT "teacher_subjects_pkey" PRIMARY KEY ("teacher_subject_id")
);

-- CreateTable
CREATE TABLE "public"."learning_materials" (
    "material_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content_type" "public"."ContentType" NOT NULL,
    "education_level" "public"."EducationLevel" NOT NULL,
    "school_grade" "public"."SchoolGrade",
    "subject_id" TEXT,
    "topic_id" TEXT,
    "file_url" TEXT,
    "rich_content" JSONB,
    "scope" "public"."ContentScope" NOT NULL DEFAULT 'GLOBAL',
    "organization_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "learning_materials_pkey" PRIMARY KEY ("material_id")
);

-- CreateTable
CREATE TABLE "public"."tests" (
    "test_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tests_pkey" PRIMARY KEY ("test_id")
);

-- CreateTable
CREATE TABLE "public"."questions" (
    "question_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "public"."QuestionType" NOT NULL,
    "order" INTEGER,
    "test_id" TEXT NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "public"."options" (
    "option_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,

    CONSTRAINT "options_pkey" PRIMARY KEY ("option_id")
);

-- CreateTable
CREATE TABLE "public"."answers" (
    "answer_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("answer_id")
);

-- CreateTable
CREATE TABLE "public"."submissions" (
    "submission_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "status" "public"."SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "public"."responses" (
    "response_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "givenText" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "feedback" TEXT,
    "explanation" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "corrected" BOOLEAN DEFAULT false,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("response_id")
);

-- CreateTable
CREATE TABLE "public"."import_batches" (
    "import_batch_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "imported_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("import_batch_id")
);

-- CreateTable
CREATE TABLE "public"."export_logs" (
    "export_log_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "exported_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_logs_pkey" PRIMARY KEY ("export_log_id")
);

-- CreateTable
CREATE TABLE "public"."TaskCompletionStats" (
    "test_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "total_submissions" INTEGER NOT NULL,
    "passed_count" INTEGER NOT NULL,
    "pass_rate" DOUBLE PRECISION NOT NULL
);

-- CreateTable
CREATE TABLE "public"."vw_student_progress" (
    "membership_id" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "classroom_name" TEXT NOT NULL,
    "total_submissions" INTEGER NOT NULL,
    "avg_score" DOUBLE PRECISION NOT NULL,
    "xp" INTEGER NOT NULL,
    "level" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "public"."vw_teacher_dashboard" (
    "teacher_id" TEXT NOT NULL,
    "teacher_name" TEXT NOT NULL,
    "classrooms_count" INTEGER NOT NULL,
    "students_count" INTEGER NOT NULL,
    "tests_count" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "public"."vw_classroom_results" (
    "classroom_id" TEXT NOT NULL,
    "classroom_name" TEXT NOT NULL,
    "avg_score" DOUBLE PRECISION NOT NULL,
    "best_score" DOUBLE PRECISION NOT NULL,
    "worst_score" DOUBLE PRECISION NOT NULL
);

-- CreateTable
CREATE TABLE "public"."_ClassroomToSubject" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ClassroomToSubject_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "organizations_name_idx" ON "public"."organizations"("name");

-- CreateIndex
CREATE INDEX "organizations_city_idx" ON "public"."organizations"("city");

-- CreateIndex
CREATE INDEX "memberships_organization_id_role_idx" ON "public"."memberships"("organization_id", "role");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "public"."memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "public"."memberships"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "public"."permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_id_key" ON "public"."role_permissions"("role", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_id_key" ON "public"."user_permissions"("user_id", "permission_id");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_idx" ON "public"."subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "public"."subscriptions"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "public"."refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "public"."audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "public"."audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "public"."audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "classrooms_organization_id_idx" ON "public"."classrooms"("organization_id");

-- CreateIndex
CREATE INDEX "classrooms_teacher_id_idx" ON "public"."classrooms"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_membership_id_key" ON "public"."teachers"("membership_id");

-- CreateIndex
CREATE INDEX "teachers_organization_id_idx" ON "public"."teachers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_membership_id_key" ON "public"."students"("membership_id");

-- CreateIndex
CREATE INDEX "students_classroom_id_idx" ON "public"."students"("classroom_id");

-- CreateIndex
CREATE INDEX "subjects_organization_id_idx" ON "public"."subjects"("organization_id");

-- CreateIndex
CREATE INDEX "topics_subject_id_idx" ON "public"."topics"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subjects_teacher_id_subject_id_key" ON "public"."teacher_subjects"("teacher_id", "subject_id");

-- CreateIndex
CREATE INDEX "_ClassroomToSubject_B_index" ON "public"."_ClassroomToSubject"("B");

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("plan_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."classrooms" ADD CONSTRAINT "classrooms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."classrooms" ADD CONSTRAINT "classrooms_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("teacher_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("classroom_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjects" ADD CONSTRAINT "subjects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."topics" ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("subject_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("teacher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("subject_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_materials" ADD CONSTRAINT "learning_materials_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("subject_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_materials" ADD CONSTRAINT "learning_materials_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("topic_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_materials" ADD CONSTRAINT "learning_materials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_materials" ADD CONSTRAINT "learning_materials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tests" ADD CONSTRAINT "tests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tests" ADD CONSTRAINT "tests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("test_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."options" ADD CONSTRAINT "options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("test_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("submission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_batches" ADD CONSTRAINT "import_batches_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."export_logs" ADD CONSTRAINT "export_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."export_logs" ADD CONSTRAINT "export_logs_exported_by_id_fkey" FOREIGN KEY ("exported_by_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ClassroomToSubject" ADD CONSTRAINT "_ClassroomToSubject_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."classrooms"("classroom_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ClassroomToSubject" ADD CONSTRAINT "_ClassroomToSubject_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."subjects"("subject_id") ON DELETE CASCADE ON UPDATE CASCADE;
