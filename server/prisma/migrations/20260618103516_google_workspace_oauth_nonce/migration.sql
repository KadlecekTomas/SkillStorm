-- CreateTable
CREATE TABLE "public"."google_oauth_nonces" (
    "google_oauth_nonce_id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_oauth_nonces_pkey" PRIMARY KEY ("google_oauth_nonce_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_oauth_nonces_nonce_key" ON "public"."google_oauth_nonces"("nonce");

-- CreateIndex
CREATE INDEX "google_oauth_nonces_expires_at_idx" ON "public"."google_oauth_nonces"("expires_at");
