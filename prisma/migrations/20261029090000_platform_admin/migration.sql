-- Digistay's operators (/admin): lock an account, flag and review plan
-- payments that came for an order no longer open, and read the platform's
-- activity log newest first.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "disabledReason" TEXT;

-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN "paidAfter" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewNote" TEXT;

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_action_createdAt_idx" ON "activity_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
