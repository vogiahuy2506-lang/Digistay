-- Plan changes (period.ts planChange): a paid downgrade waits in next*; how each payment was applied.
-- Plan e-invoices issued by Digistay through its own Mắt Bão account (src/lib/billing/einvoice.ts).

-- CreateEnum
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('PENDING', 'ISSUING', 'ISSUED', 'FAILED');

-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN     "change" TEXT,
ADD COLUMN     "invoiceBuyer" JSONB;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "nextBilling" "BillingPeriod",
ADD COLUMN     "nextPaymentId" TEXT,
ADD COLUMN     "nextPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "nextPlan" TEXT;

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "buyerType" TEXT NOT NULL,
    "buyerName" TEXT,
    "idNumber" TEXT,
    "companyName" TEXT,
    "taxCode" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "amount" INTEGER NOT NULL,
    "vatCode" INTEGER NOT NULL,
    "lookupCode" TEXT NOT NULL,
    "environment" TEXT,
    "templateCode" TEXT,
    "series" TEXT,
    "invoiceCode" TEXT,
    "einvoiceNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "error" TEXT,
    "cqtStatus" INTEGER,
    "cqtNote" TEXT,
    "emailStatus" TEXT,
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailNextAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "emailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_paymentId_key" ON "subscription_invoices"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_lookupCode_key" ON "subscription_invoices"("lookupCode");

-- CreateIndex
CREATE INDEX "subscription_invoices_status_nextAttemptAt_idx" ON "subscription_invoices"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "subscription_invoices_emailStatus_emailNextAt_idx" ON "subscription_invoices"("emailStatus", "emailNextAt");

-- CreateIndex
CREATE INDEX "subscription_invoices_workspaceId_createdAt_idx" ON "subscription_invoices"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "subscription_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

