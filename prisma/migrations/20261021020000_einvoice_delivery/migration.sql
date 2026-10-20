-- Auto-issue and email of e-invoices (src/lib/einvoice/jobs.ts, delivery.ts).
-- Additive only: nullable columns, or NOT NULL with a DEFAULT.
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "autoIssued" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailNextAt" TIMESTAMP(3),
ADD COLUMN     "emailStatus" TEXT,
ADD COLUMN     "emailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "property_einvoice" ADD COLUMN     "autoIssue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoIssueSince" TIMESTAMP(3),
ADD COLUMN     "emailInvoices" BOOLEAN NOT NULL DEFAULT true;
