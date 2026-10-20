-- Mắt Bão tax-office status webhook (src/lib/einvoice/matbao-webhook.ts). Additive
-- only: nullable columns.
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "cqtCode" TEXT,
ADD COLUMN     "cqtNote" TEXT,
ADD COLUMN     "cqtStatus" INTEGER;

-- AlterTable
ALTER TABLE "property_einvoice" ADD COLUMN     "webhookToken" TEXT;

