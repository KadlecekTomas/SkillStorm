-- CreateEnum
CREATE TYPE "public"."SessionInitiation" AS ENUM ('GUARDIAN');

-- CreateEnum
CREATE TYPE "public"."ChildVerification" AS ENUM ('NONE', 'PIN');

-- CreateEnum
CREATE TYPE "public"."LearningSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."GuardianLaunchPolicy" AS ENUM ('DISABLED', 'ALLOWED', 'REQUIRE_CHILD_PIN');

-- POZOR: prisma diff sem vygenerovala DROP ručně spravovaných invariantů
-- (composite FK z Etapy B + memberships unique) jako „drift" — odstraněno.
-- Stejná chyba v migraci 20260301223140 stála enrollments org-FK (PR #25).

-- AlterTable
ALTER TABLE "public"."assignments" ADD COLUMN     "guardian_launch_policy" "public"."GuardianLaunchPolicy" NOT NULL DEFAULT 'DISABLED';

-- AlterTable
ALTER TABLE "public"."submissions" ADD COLUMN     "learning_session_id" TEXT;

-- CreateTable
CREATE TABLE "public"."learning_sessions" (
    "learning_session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "initiator_membership_id" TEXT NOT NULL,
    "guardian_relation_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "initiated_via" "public"."SessionInitiation" NOT NULL DEFAULT 'GUARDIAN',
    "verification_method" "public"."ChildVerification" NOT NULL DEFAULT 'NONE',
    "assistance_declared" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."LearningSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("learning_session_id")
);

-- CreateIndex
CREATE INDEX "learning_sessions_student_id_status_idx" ON "public"."learning_sessions"("student_id", "status");

-- CreateIndex
CREATE INDEX "learning_sessions_organization_id_idx" ON "public"."learning_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "learning_sessions_assignment_id_idx" ON "public"."learning_sessions"("assignment_id");

-- CreateIndex
CREATE INDEX "submissions_learning_session_id_idx" ON "public"."submissions"("learning_session_id");

-- AddForeignKey
ALTER TABLE "public"."learning_sessions" ADD CONSTRAINT "learning_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_sessions" ADD CONSTRAINT "learning_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_sessions" ADD CONSTRAINT "learning_sessions_initiator_membership_id_fkey" FOREIGN KEY ("initiator_membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_sessions" ADD CONSTRAINT "learning_sessions_guardian_relation_id_fkey" FOREIGN KEY ("guardian_relation_id") REFERENCES "public"."guardian_student_relations"("guardian_student_relation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."learning_sessions" ADD CONSTRAINT "learning_sessions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("assignment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_sessions"("learning_session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── DB invarianty (vzor guardian_student_relations, Etapa B) ────────────────
-- 1) Žákovská i iniciátorská strana relace musí patřit do organizace relace.
ALTER TABLE "public"."learning_sessions"
  ADD CONSTRAINT "learning_sessions_student_org_fkey"
  FOREIGN KEY ("student_id", "organization_id")
  REFERENCES "public"."students" ("student_id", "organization_id")
  ON DELETE CASCADE;

ALTER TABLE "public"."learning_sessions"
  ADD CONSTRAINT "learning_sessions_initiator_org_fkey"
  FOREIGN KEY ("initiator_membership_id", "organization_id")
  REFERENCES "public"."memberships" ("membership_id", "organization_id")
  ON DELETE CASCADE;

-- 2) Jedna ACTIVE relace na dítě — sourozenci na jednom zařízení se nikdy
--    nepromíchají; druhé spuštění musí první relaci ukončit.
CREATE UNIQUE INDEX "learning_session_single_active_per_student"
  ON "public"."learning_sessions" ("student_id")
  WHERE "status" = 'ACTIVE';
