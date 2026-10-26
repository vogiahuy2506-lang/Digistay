-- Digistay plans (src/lib/billing): one subscription per workspace and the PayOS
-- payments that buy plans. New tables only, so the previous release runs on it.

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "subscriptions" (
    "workspaceId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billing" "BillingPeriod",
    "trial" BOOLEAN NOT NULL DEFAULT true,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "reminders" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billing" "BillingPeriod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "orderCode" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "qrCode" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_periodEnd_idx" ON "subscriptions"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_orderCode_key" ON "subscription_payments"("orderCode");

-- CreateIndex
CREATE INDEX "subscription_payments_workspaceId_createdAt_idx" ON "subscription_payments"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "subscription_payments_status_createdAt_idx" ON "subscription_payments"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every workspace that exists now starts the 14-day trial of Growth today.
INSERT INTO "subscriptions" ("workspaceId", "plan", "trial", "periodStart", "periodEnd", "updatedAt")
SELECT "id", 'growth', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '14 days', CURRENT_TIMESTAMP FROM "workspaces"
ON CONFLICT ("workspaceId") DO NOTHING;
