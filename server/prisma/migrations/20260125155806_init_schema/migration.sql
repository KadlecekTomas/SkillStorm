-- CreateEnum
CREATE TYPE "public"."SystemRole" AS ENUM ('SUPERADMIN', 'DEVOPS', 'SUPPORT');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."MaterialAccessLevel" AS ENUM ('FREE', 'SCHOOL_ONLY', 'PAID');

-- CreateEnum
CREATE TYPE "public"."OrganizationRole" AS ENUM ('STUDENT', 'TEACHER', 'DIRECTOR', 'OWNER', 'PARENT');

-- CreateEnum
CREATE TYPE "public"."PermissionKey" AS ENUM ('CREATE_TEST', 'EDIT_TEST', 'DELETE_TEST', 'VIEW_RESULTS', 'MANAGE_STUDENTS', 'MANAGE_TEACHERS', 'VIEW_ANALYTICS');

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

-- CreateEnum
CREATE TYPE "public"."PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."TopicPhase" AS ENUM ('INTRO', 'DEEPEN', 'RECAP', 'EXTENSION');

-- CreateEnum
CREATE TYPE "public"."Difficulty" AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "public"."EnrollmentStatus" AS ENUM ('ACTIVE', 'RETAINED', 'TRANSFERRED', 'GRADUATED', 'LEFT');

-- CreateEnum
CREATE TYPE "public"."ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."XpEventType" AS ENUM ('LOGIN', 'TEST_COMPLETION', 'MATERIAL_VIEW', 'CUSTOM', 'USER_LOGIN', 'MATERIAL_VIEWED', 'TEST_COMPLETED');

-- CreateTable
CREATE TABLE "public"."users" (
    "user_id" TEXT NOT NULL,
    "email" VARCHAR(320),
    "username" VARCHAR(64),
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "preferred_lang" VARCHAR(10),
    "system_role" "public"."SystemRole",
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "last_active_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "anonymized" BOOLEAN NOT NULL DEFAULT false,
    "anonymized_at" TIMESTAMP(3),

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
CREATE TABLE "public"."organization_settings" (
    "organization_settings_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "usernamePattern" TEXT NOT NULL DEFAULT '{surname}{fi}{yy}',
    "domainAlias" TEXT,
    "initialPassword" TEXT NOT NULL DEFAULT 'ChangeMe!{yy}',
    "forceResetOnFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "ssoProvider" TEXT,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("organization_settings_id")
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "public"."levels" (
    "level_id" TEXT NOT NULL,
    "level_no" INTEGER NOT NULL,
    "min_xp" INTEGER NOT NULL,
    "badge_url" TEXT,
    "rewards" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("level_id")
);

-- CreateTable
CREATE TABLE "public"."xp_events" (
    "xp_event_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "event_type" "public"."XpEventType" NOT NULL,
    "value" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("xp_event_id")
);

-- CreateTable
CREATE TABLE "public"."achievements" (
    "achievement_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "condition" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("achievement_id")
);

-- CreateTable
CREATE TABLE "public"."membership_achievements" (
    "membership_achievement_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_achievements_pkey" PRIMARY KEY ("membership_achievement_id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "permission_id" TEXT NOT NULL,
    "key" "public"."PermissionKey" NOT NULL,
    "description" TEXT,
    "allowedTypes" "public"."OrganizationType"[],
    "category" VARCHAR(100),
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "role_permission_id" TEXT NOT NULL,
    "role" "public"."OrganizationRole" NOT NULL,
    "permission_id" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "organization_id" TEXT,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_permission_id")
);

-- CreateTable
CREATE TABLE "public"."user_permissions" (
    "user_permission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "organization_id" TEXT,

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
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("refresh_token_id")
);

-- CreateTable
CREATE TABLE "public"."revoked_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,

    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."analytics_events" (
    "analytics_event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "category" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" VARCHAR(120),
    "value" INTEGER,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("analytics_event_id")
);

-- CreateTable
CREATE TABLE "public"."academic_years" (
    "academic_year_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("academic_year_id")
);

-- CreateTable
CREATE TABLE "public"."class_sections" (
    "class_section_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "grade" "public"."SchoolGrade" NOT NULL,
    "section" TEXT NOT NULL,
    "label" TEXT,
    "teacher_id" TEXT,

    CONSTRAINT "class_sections_pkey" PRIMARY KEY ("class_section_id")
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
    "organization_id" TEXT NOT NULL,
    "studentNumber" TEXT,
    "externalId" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "public"."enrollments" (
    "enrollment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "status" "public"."EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateTable
CREATE TABLE "public"."catalog_subjects" (
    "catalog_subject_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "catalog_subjects_pkey" PRIMARY KEY ("catalog_subject_id")
);

-- CreateTable
CREATE TABLE "public"."catalog_topics" (
    "catalog_topic_id" TEXT NOT NULL,
    "catalog_subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "catalog_topics_pkey" PRIMARY KEY ("catalog_topic_id")
);

-- CreateTable
CREATE TABLE "public"."subjects" (
    "subject_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "catalog_subject_id" TEXT,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("subject_id")
);

-- CreateTable
CREATE TABLE "public"."subject_levels" (
    "subject_level_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "grade" "public"."SchoolGrade" NOT NULL,
    "order" INTEGER,
    "label" TEXT,

    CONSTRAINT "subject_levels_pkey" PRIMARY KEY ("subject_level_id")
);

-- CreateTable
CREATE TABLE "public"."topic_levels" (
    "topic_level_id" TEXT NOT NULL,
    "subject_level_id" TEXT NOT NULL,
    "catalog_topic_id" TEXT NOT NULL,
    "name" TEXT,
    "phase" "public"."TopicPhase" NOT NULL DEFAULT 'INTRO',
    "difficulty" "public"."Difficulty" NOT NULL DEFAULT 'BASIC',
    "order" INTEGER,
    "objectives" JSONB,
    "prerequisites" JSONB,

    CONSTRAINT "topic_levels_pkey" PRIMARY KEY ("topic_level_id")
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
    "topic_level_id" TEXT,
    "file_url" TEXT,
    "rich_content" JSONB,
    "scope" "public"."ContentScope" NOT NULL DEFAULT 'GLOBAL',
    "organization_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "access_level" "public"."MaterialAccessLevel" NOT NULL DEFAULT 'FREE',
    "price" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'CZK',
    "is_downloadable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "learning_materials_pkey" PRIMARY KEY ("material_id")
);

-- CreateTable
CREATE TABLE "public"."student_classrooms" (
    "student_classroom_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topicLevelId" TEXT,

    CONSTRAINT "student_classrooms_pkey" PRIMARY KEY ("student_classroom_id")
);

-- CreateTable
CREATE TABLE "public"."material_assignments" (
    "material_assignment_id" TEXT NOT NULL,
    "topic_level_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER,

    CONSTRAINT "material_assignments_pkey" PRIMARY KEY ("material_assignment_id")
);

-- CreateTable
CREATE TABLE "public"."material_purchases" (
    "material_purchase_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purchased_by_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_purchases_pkey" PRIMARY KEY ("material_purchase_id")
);

-- CreateTable
CREATE TABLE "public"."tests" (
    "test_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "order" INTEGER,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tests_pkey" PRIMARY KEY ("test_id")
);

-- CreateTable
CREATE TABLE "public"."test_assignments" (
    "test_assignment_id" TEXT NOT NULL,
    "topic_level_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER,

    CONSTRAINT "test_assignments_pkey" PRIMARY KEY ("test_assignment_id")
);

-- CreateTable
CREATE TABLE "public"."questions" (
    "question_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "public"."QuestionType" NOT NULL,
    "order" INTEGER,
    "test_id" TEXT NOT NULL,
    "correctAnswer" TEXT,
    "correctAnswers" TEXT[],
    "score" INTEGER NOT NULL DEFAULT 1,

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
    "submitted_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "assignment_id" TEXT,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,

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
    "status" "public"."ImportStatus" NOT NULL,
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
CREATE TABLE "public"."assignments" (
    "assignment_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'CLASS',
    "class_section_id" TEXT,
    "topic_level_id" TEXT,
    "openAt" TIMESTAMP(3) NOT NULL,
    "closeAt" TIMESTAMP(3) NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "time_limit_sec" INTEGER,
    "shuffle" BOOLEAN NOT NULL DEFAULT true,
    "showExplain" TEXT NOT NULL DEFAULT 'after_close',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "public"."assignment_students" (
    "assignment_student_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,

    CONSTRAINT "assignment_students_pkey" PRIMARY KEY ("assignment_student_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_last_active_membership_id_key" ON "public"."users"("last_active_membership_id");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "organizations_name_idx" ON "public"."organizations"("name");

-- CreateIndex
CREATE INDEX "organizations_city_idx" ON "public"."organizations"("city");

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "public"."organization_settings"("organization_id");

-- CreateIndex
CREATE INDEX "memberships_organization_id_role_idx" ON "public"."memberships"("organization_id", "role");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "public"."memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "public"."memberships"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "levels_level_no_key" ON "public"."levels"("level_no");

-- CreateIndex
CREATE INDEX "xp_events_membership_id_event_type_idx" ON "public"."xp_events"("membership_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "membership_achievements_membership_id_achievement_id_key" ON "public"."membership_achievements"("membership_id", "achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "public"."permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_organization_id_role_permission_id_key" ON "public"."role_permissions"("organization_id", "role", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_organization_id_permission_id_key" ON "public"."user_permissions"("user_id", "organization_id", "permission_id");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_idx" ON "public"."subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "public"."subscriptions"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "public"."refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "revoked_tokens_token_key" ON "public"."revoked_tokens"("token");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "public"."audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "public"."audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "public"."audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "analytics_events_organization_id_category_idx" ON "public"."analytics_events"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_organization_id_label_key" ON "public"."academic_years"("organization_id", "label");

-- CreateIndex
CREATE INDEX "class_sections_organization_id_grade_idx" ON "public"."class_sections"("organization_id", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "class_sections_organization_id_academic_year_id_grade_secti_key" ON "public"."class_sections"("organization_id", "academic_year_id", "grade", "section");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_membership_id_key" ON "public"."teachers"("membership_id");

-- CreateIndex
CREATE INDEX "teachers_organization_id_idx" ON "public"."teachers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_membership_id_key" ON "public"."students"("membership_id");

-- CreateIndex
CREATE INDEX "students_organization_id_studentNumber_idx" ON "public"."students"("organization_id", "studentNumber");

-- CreateIndex
CREATE INDEX "enrollments_class_section_id_idx" ON "public"."enrollments"("class_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_academic_year_id_key" ON "public"."enrollments"("student_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_subjects_code_key" ON "public"."catalog_subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_topics_catalog_subject_id_name_key" ON "public"."catalog_topics"("catalog_subject_id", "name");

-- CreateIndex
CREATE INDEX "subjects_organization_id_idx" ON "public"."subjects"("organization_id");

-- CreateIndex
CREATE INDEX "subjects_catalog_subject_id_idx" ON "public"."subjects"("catalog_subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_organization_id_catalog_subject_id_key" ON "public"."subjects"("organization_id", "catalog_subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_levels_subject_id_grade_key" ON "public"."subject_levels"("subject_id", "grade");

-- CreateIndex
CREATE INDEX "topic_levels_catalog_topic_id_idx" ON "public"."topic_levels"("catalog_topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_levels_subject_level_id_catalog_topic_id_phase_key" ON "public"."topic_levels"("subject_level_id", "catalog_topic_id", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subjects_teacher_id_subject_id_key" ON "public"."teacher_subjects"("teacher_id", "subject_id");

-- CreateIndex
CREATE INDEX "learning_materials_topic_level_id_idx" ON "public"."learning_materials"("topic_level_id");

-- CreateIndex
CREATE INDEX "student_classrooms_class_section_id_schoolYear_idx" ON "public"."student_classrooms"("class_section_id", "schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "student_classrooms_student_id_schoolYear_key" ON "public"."student_classrooms"("student_id", "schoolYear");

-- CreateIndex
CREATE INDEX "material_assignments_material_id_idx" ON "public"."material_assignments"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_assignments_topic_level_id_material_id_key" ON "public"."material_assignments"("topic_level_id", "material_id");

-- CreateIndex
CREATE INDEX "material_purchases_organization_id_material_id_idx" ON "public"."material_purchases"("organization_id", "material_id");

-- CreateIndex
CREATE INDEX "test_assignments_test_id_idx" ON "public"."test_assignments"("test_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_assignments_topic_level_id_test_id_key" ON "public"."test_assignments"("topic_level_id", "test_id");

-- CreateIndex
CREATE INDEX "submissions_assignment_id_idx" ON "public"."submissions"("assignment_id");

-- CreateIndex
CREATE INDEX "submissions_test_id_status_idx" ON "public"."submissions"("test_id", "status");

-- CreateIndex
CREATE INDEX "submissions_student_id_submitted_at_idx" ON "public"."submissions"("student_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignment_id_student_id_attempt_no_key" ON "public"."submissions"("assignment_id", "student_id", "attempt_no");

-- CreateIndex
CREATE INDEX "responses_submission_id_idx" ON "public"."responses"("submission_id");

-- CreateIndex
CREATE INDEX "responses_question_id_idx" ON "public"."responses"("question_id");

-- CreateIndex
CREATE INDEX "assignments_organization_id_class_section_id_idx" ON "public"."assignments"("organization_id", "class_section_id");

-- CreateIndex
CREATE INDEX "assignments_test_id_idx" ON "public"."assignments"("test_id");

-- CreateIndex
CREATE INDEX "assignment_students_student_id_idx" ON "public"."assignment_students"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_students_assignment_id_student_id_key" ON "public"."assignment_students"("assignment_id", "student_id");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_last_active_membership_id_fkey" FOREIGN KEY ("last_active_membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."xp_events" ADD CONSTRAINT "xp_events_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_achievements" ADD CONSTRAINT "membership_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("achievement_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_achievements" ADD CONSTRAINT "membership_achievements_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("plan_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."revoked_tokens" ADD CONSTRAINT "revoked_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_years" ADD CONSTRAINT "academic_years_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_sections" ADD CONSTRAINT "class_sections_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_sections" ADD CONSTRAINT "class_sections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_sections" ADD CONSTRAINT "class_sections_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("teacher_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."catalog_topics" ADD CONSTRAINT "catalog_topics_catalog_subject_id_fkey" FOREIGN KEY ("catalog_subject_id") REFERENCES "public"."catalog_subjects"("catalog_subject_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjects" ADD CONSTRAINT "subjects_catalog_subject_id_fkey" FOREIGN KEY ("catalog_subject_id") REFERENCES "public"."catalog_subjects"("catalog_subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjects" ADD CONSTRAINT "subjects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subject_levels" ADD CONSTRAINT "subject_levels_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("subject_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."topic_levels" ADD CONSTRAINT "topic_levels_catalog_topic_id_fkey" FOREIGN KEY ("catalog_topic_id") REFERENCES "public"."catalog_topics"("catalog_topic_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."topic_levels" ADD CONSTRAINT "topic_levels_subject_level_id_fkey" FOREIGN KEY ("subject_level_id") REFERENCES "public"."subject_levels"("subject_level_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("subject_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("teacher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_materials" ADD CONSTRAINT "learning_materials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_materials" ADD CONSTRAINT "learning_materials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_materials" ADD CONSTRAINT "learning_materials_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("subject_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_materials" ADD CONSTRAINT "learning_materials_topic_level_id_fkey" FOREIGN KEY ("topic_level_id") REFERENCES "public"."topic_levels"("topic_level_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_classrooms" ADD CONSTRAINT "student_classrooms_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_classrooms" ADD CONSTRAINT "student_classrooms_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_classrooms" ADD CONSTRAINT "student_classrooms_topicLevelId_fkey" FOREIGN KEY ("topicLevelId") REFERENCES "public"."topic_levels"("topic_level_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_assignments" ADD CONSTRAINT "material_assignments_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."learning_materials"("material_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_assignments" ADD CONSTRAINT "material_assignments_topic_level_id_fkey" FOREIGN KEY ("topic_level_id") REFERENCES "public"."topic_levels"("topic_level_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_purchases" ADD CONSTRAINT "material_purchases_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."learning_materials"("material_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_purchases" ADD CONSTRAINT "material_purchases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_purchases" ADD CONSTRAINT "material_purchases_purchased_by_id_fkey" FOREIGN KEY ("purchased_by_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tests" ADD CONSTRAINT "tests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tests" ADD CONSTRAINT "tests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_assignments" ADD CONSTRAINT "test_assignments_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("test_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_assignments" ADD CONSTRAINT "test_assignments_topic_level_id_fkey" FOREIGN KEY ("topic_level_id") REFERENCES "public"."topic_levels"("topic_level_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("test_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."options" ADD CONSTRAINT "options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("assignment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("test_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("submission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_batches" ADD CONSTRAINT "import_batches_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."export_logs" ADD CONSTRAINT "export_logs_exported_by_id_fkey" FOREIGN KEY ("exported_by_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."export_logs" ADD CONSTRAINT "export_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("test_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_topic_level_id_fkey" FOREIGN KEY ("topic_level_id") REFERENCES "public"."topic_levels"("topic_level_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignment_students" ADD CONSTRAINT "assignment_students_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("assignment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignment_students" ADD CONSTRAINT "assignment_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;
