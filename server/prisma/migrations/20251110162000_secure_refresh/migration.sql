ALTER TABLE "refresh_tokens" ADD COLUMN "token_hash" TEXT;
UPDATE "refresh_tokens" SET "token_hash" = "token";
ALTER TABLE "refresh_tokens" ALTER COLUMN "token_hash" SET NOT NULL;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash");
ALTER TABLE "refresh_tokens" ADD COLUMN "revoked_at" TIMESTAMP(3);
ALTER TABLE "refresh_tokens" DROP COLUMN "token";
