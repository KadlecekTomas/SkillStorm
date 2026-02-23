-- CreateTable
CREATE TABLE "promotion_logs" (
    "promotion_log_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "from_year_id" TEXT NOT NULL,
    "to_year_id" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_by" TEXT NOT NULL,

    CONSTRAINT "promotion_logs_pkey" PRIMARY KEY ("promotion_log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotion_logs_organization_id_from_year_id_key" ON "promotion_logs"("organization_id", "from_year_id");

-- AddForeignKey
ALTER TABLE "promotion_logs" ADD CONSTRAINT "promotion_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
