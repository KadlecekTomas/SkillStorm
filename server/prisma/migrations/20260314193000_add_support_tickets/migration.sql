-- Add support ticket entity type to audit enum
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET';

-- Create lightweight support tickets table
CREATE TABLE IF NOT EXISTS "support_tickets" (
  "support_ticket_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "message" TEXT NOT NULL,
  "page" VARCHAR(255),
  "metadata" JSONB,
  "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  "resolved_by_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("support_ticket_id"),
  CONSTRAINT "support_tickets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "support_tickets_organization_id_status_created_at_idx"
  ON "support_tickets"("organization_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "support_tickets_user_id_created_at_idx"
  ON "support_tickets"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "support_tickets_resolved_by_id_idx"
  ON "support_tickets"("resolved_by_id");
