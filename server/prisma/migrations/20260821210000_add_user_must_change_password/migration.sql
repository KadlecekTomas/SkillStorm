-- Existing accounts remain unaffected; only newly imported accounts opt in.
ALTER TABLE "users"
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
