-- CreateTable
CREATE TABLE "public"."invites" (
    "invite_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "code" VARCHAR(64),
    "role" "public"."OrganizationRole" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("invite_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "public"."invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "public"."invites"("code");

-- CreateIndex
CREATE INDEX "invites_organization_id_idx" ON "public"."invites"("organization_id");

-- AddForeignKey
ALTER TABLE "public"."invites" ADD CONSTRAINT "invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
