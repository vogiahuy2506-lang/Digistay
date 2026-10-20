-- Replacement invoices (src/lib/einvoice/replacement.ts). Additive only: one
-- nullable column and its foreign key.
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "replacesInvoiceId" TEXT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_replacesInvoiceId_fkey" FOREIGN KEY ("replacesInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

