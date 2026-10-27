-- The owner is told once when the workspace nears (80%) or reaches its
-- plan's limits (src/lib/billing/usage-alerts.ts): what was told already.

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "usageAlerts" JSONB;
