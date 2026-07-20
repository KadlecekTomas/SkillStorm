-- CreateEnum
CREATE TYPE "public"."GuardianRelationType" AS ENUM ('PARENT', 'LEGAL_GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."GuardianRelationStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISPUTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."GuardianPermissionKey" AS ENUM ('VIEW_RESULTS', 'VIEW_ASSIGNMENTS', 'START_PRACTICE', 'START_HOMEWORK', 'START_TEST', 'RECEIVE_NOTIFICATIONS', 'MANAGE_STUDENT_ACCESS', 'RESET_STUDENT_PIN');

-- CreateEnum
CREATE TYPE "public"."InterfaceDetailLevel" AS ENUM ('BASIC', 'DETAILED');

-- AlterEnum
ALTER TYPE "public"."InvitationType" ADD VALUE 'GUARDIAN';

-- AlterTable
ALTER TABLE "public"."invites" ADD COLUMN     "target_student_id" TEXT;

-- AlterTable
ALTER TABLE "public"."students" ADD COLUMN     "pin_failed_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pin_hash" VARCHAR(255),
ADD COLUMN     "pin_locked_until" TIMESTAMP(3),
ADD COLUMN     "pin_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "interface_detail_level" "public"."InterfaceDetailLevel" NOT NULL DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "public"."guardian_student_relations" (
    "guardian_student_relation_id" TEXT NOT NULL,
    "guardian_membership_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "public"."GuardianRelationType" NOT NULL DEFAULT 'PARENT',
    "status" "public"."GuardianRelationStatus" NOT NULL DEFAULT 'PENDING',
    "permissions" "public"."GuardianPermissionKey"[] DEFAULT ARRAY[]::"public"."GuardianPermissionKey"[],
    "verified_at" TIMESTAMP(3),
    "verified_by_membership_id" TEXT,
    "disputed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_membership_id" TEXT,
    "valid_until" TIMESTAMP(3),
    "notification_prefs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_student_relations_pkey" PRIMARY KEY ("guardian_student_relation_id")
);

-- CreateIndex
CREATE INDEX "guardian_student_relations_organization_id_idx" ON "public"."guardian_student_relations"("organization_id");

-- CreateIndex
CREATE INDEX "guardian_student_relations_student_id_idx" ON "public"."guardian_student_relations"("student_id");

-- CreateIndex
CREATE INDEX "guardian_student_relations_guardian_membership_id_idx" ON "public"."guardian_student_relations"("guardian_membership_id");

-- CreateIndex
CREATE INDEX "invites_target_student_id_idx" ON "public"."invites"("target_student_id");

-- AddForeignKey
ALTER TABLE "public"."invites" ADD CONSTRAINT "invites_target_student_id_fkey" FOREIGN KEY ("target_student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guardian_student_relations" ADD CONSTRAINT "guardian_student_relations_guardian_membership_id_fkey" FOREIGN KEY ("guardian_membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guardian_student_relations" ADD CONSTRAINT "guardian_student_relations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guardian_student_relations" ADD CONSTRAINT "guardian_student_relations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guardian_student_relations" ADD CONSTRAINT "guardian_student_relations_verified_by_membership_id_fkey" FOREIGN KEY ("verified_by_membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guardian_student_relations" ADD CONSTRAINT "guardian_student_relations_revoked_by_membership_id_fkey" FOREIGN KEY ("revoked_by_membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── DB invarianty (vzor enrollments_student_org_fk) ─────────────────────────
-- 1) Composite unique na memberships — cíl pro composite FK guardian strany.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memberships_membership_id_organization_id_key'
  ) THEN
    ALTER TABLE "public"."memberships"
      ADD CONSTRAINT "memberships_membership_id_organization_id_key"
      UNIQUE ("membership_id", "organization_id");
  END IF;
END $$;

-- 2) Guardian strana vztahu musí patřit do téže organizace jako vztah.
ALTER TABLE "public"."guardian_student_relations"
  ADD CONSTRAINT "guardian_relations_membership_org_fkey"
  FOREIGN KEY ("guardian_membership_id", "organization_id")
  REFERENCES "public"."memberships" ("membership_id", "organization_id")
  ON DELETE CASCADE;

-- 3) Žákovská strana vztahu musí patřit do téže organizace jako vztah.
--    Composite unique na students vznikla v migraci 20260223013000, ale
--    migrace 20260301223140 ji (spolu s enrollments org-FK) dropla —
--    idempotentně ji obnovujeme.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_student_id_organization_id_key'
  ) THEN
    ALTER TABLE "public"."students"
      ADD CONSTRAINT "students_student_id_organization_id_key"
      UNIQUE ("student_id", "organization_id");
  END IF;
END $$;

ALTER TABLE "public"."guardian_student_relations"
  ADD CONSTRAINT "guardian_relations_student_org_fkey"
  FOREIGN KEY ("student_id", "organization_id")
  REFERENCES "public"."students" ("student_id", "organization_id")
  ON DELETE CASCADE;

-- 4) Jeden živý (ne-REVOKED) vztah na pár rodič×dítě; revokovaná historie
--    zůstává. DISPUTED je živý stav (blokuje nový kód, dokud ho škola
--    nevyřeší revokací).
CREATE UNIQUE INDEX "guardian_relation_single_live_per_pair"
  ON "public"."guardian_student_relations" ("guardian_membership_id", "student_id")
  WHERE "revoked_at" IS NULL;
