CREATE TABLE "public"."badge_definitions" (
    "badge_definition_id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "icon_key" VARCHAR(100),
    "xp_reward" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("badge_definition_id")
);

CREATE TABLE "public"."membership_badges" (
    "membership_badge_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "badge_definition_id" TEXT NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "membership_badges_pkey" PRIMARY KEY ("membership_badge_id")
);

CREATE UNIQUE INDEX "badge_definitions_code_key" ON "public"."badge_definitions"("code");
CREATE INDEX "badge_definitions_code_idx" ON "public"."badge_definitions"("code");
CREATE UNIQUE INDEX "membership_badges_membership_id_badge_definition_id_key" ON "public"."membership_badges"("membership_id", "badge_definition_id");
CREATE INDEX "membership_badges_membership_id_awarded_at_idx" ON "public"."membership_badges"("membership_id", "awarded_at");
CREATE INDEX "membership_badges_badge_definition_id_idx" ON "public"."membership_badges"("badge_definition_id");

ALTER TABLE "public"."membership_badges"
ADD CONSTRAINT "membership_badges_membership_id_fkey"
FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."membership_badges"
ADD CONSTRAINT "membership_badges_badge_definition_id_fkey"
FOREIGN KEY ("badge_definition_id") REFERENCES "public"."badge_definitions"("badge_definition_id")
ON DELETE CASCADE ON UPDATE CASCADE;
