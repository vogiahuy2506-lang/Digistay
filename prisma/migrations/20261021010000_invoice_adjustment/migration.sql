-- Adjustment invoices (src/lib/einvoice/adjustment.ts). Additive only: one
-- nullable column and its foreign key.
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "adjustsInvoiceId" TEXT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_adjustsInvoiceId_fkey" FOREIGN KEY ("adjustsInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
