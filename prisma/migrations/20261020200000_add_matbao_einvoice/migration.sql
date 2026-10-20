-- Part 6: per-property Mắt Bão e-invoices (src/lib/einvoice/matbao.ts). Additive
-- only: the previous release ignores the new enum values, columns and table.
-- AlterEnum
ALTER TYPE "EInvoiceProvider" ADD VALUE 'MATBAO';

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PUBLISHING';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "buyerType" TEXT NOT NULL DEFAULT 'company',
ADD COLUMN     "einvoiceNumber" TEXT,
ADD COLUMN     "lookupCode" TEXT,
ADD COLUMN     "publishError" TEXT,
ADD COLUMN     "vatCode" INTEGER;

-- CreateTable
CREATE TABLE "property_einvoice" (
    "propertyId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "taxCode" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "vatCode" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "remainingNumbers" INTEGER,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_einvoice_pkey" PRIMARY KEY ("propertyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_lookupCode_key" ON "invoices"("lookupCode");

-- AddForeignKey
ALTER TABLE "property_einvoice" ADD CONSTRAINT "property_einvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

