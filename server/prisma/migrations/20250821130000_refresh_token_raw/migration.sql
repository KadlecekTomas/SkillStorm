-- Rename legacy token_hash to token if present (PostgreSQL lacks IF EXISTS on RENAME COLUMN)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE "refresh_tokens" RENAME COLUMN "token_hash" TO "token";
  END IF;
END $$;

-- Create table refresh_tokens if it does not exist
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "refresh_token_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "token" TEXT UNIQUE,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ
);

-- Ensure token column exists and is TEXT
ALTER TABLE "refresh_tokens"
  ADD COLUMN IF NOT EXISTS "token" TEXT;

-- Drop legacy plaintext column hashed_token if it exists
ALTER TABLE "refresh_tokens"
  DROP COLUMN IF EXISTS "hashed_token";

-- Keep revoked_at column (used for revocation)
ALTER TABLE "refresh_tokens"
  ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP;

-- Ensure FK and index on user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refresh_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE "refresh_tokens"
      ADD CONSTRAINT "refresh_tokens_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens" ("user_id");

-- Remove legacy is_anonymized flags
ALTER TABLE IF EXISTS "users" DROP COLUMN IF EXISTS "is_anonymized";
ALTER TABLE IF EXISTS "memberships" DROP COLUMN IF EXISTS "is_anonymized";

-- Ensure submissions has is_anonymous flag
ALTER TABLE IF EXISTS "submissions"
  ADD COLUMN IF NOT EXISTS "is_anonymous" BOOLEAN NOT NULL DEFAULT false;
