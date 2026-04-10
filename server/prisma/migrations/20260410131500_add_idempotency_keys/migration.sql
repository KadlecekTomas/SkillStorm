CREATE TABLE "public"."idempotency_keys" (
    "idempotency_key_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("idempotency_key_id")
);

CREATE UNIQUE INDEX "idempotency_keys_user_id_operation_key_key"
  ON "public"."idempotency_keys"("user_id", "operation", "key");

CREATE INDEX "idempotency_keys_user_id_operation_created_at_idx"
  ON "public"."idempotency_keys"("user_id", "operation", "created_at");

ALTER TABLE "public"."idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
