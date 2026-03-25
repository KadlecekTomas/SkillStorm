CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "support_tickets"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SupportTicketStatus"
  USING (
    CASE
      WHEN "status" = 'RESOLVED' THEN 'RESOLVED'::"SupportTicketStatus"
      ELSE 'OPEN'::"SupportTicketStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'OPEN';

ALTER TABLE "support_tickets"
  ADD COLUMN "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "assigned_to_id" TEXT,
  ADD COLUMN "internal_note" TEXT,
  ADD COLUMN "resolution_note" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "support_tickets_assigned_to_id_status_idx"
ON "support_tickets"("assigned_to_id", "status");

ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "users"("user_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
