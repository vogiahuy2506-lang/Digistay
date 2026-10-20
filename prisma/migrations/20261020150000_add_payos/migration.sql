-- Part 5: per-property PayOS (src/lib/payments/payos.ts). Additive only: the
-- previous release ignores the new enum value, columns and table.
-- AlterEnum
ALTER TYPE "PaymentGateway" ADD VALUE 'PAYOS';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "gatewayOrderCode" TEXT;

-- CreateTable
CREATE TABLE "property_payos" (
    "propertyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "checksumKey" TEXT NOT NULL,
    "webhookConfirmedAt" TIMESTAMP(3),
    "accountName" TEXT,
    "accountNumber" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_payos_pkey" PRIMARY KEY ("propertyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayOrderCode_key" ON "payments"("gatewayOrderCode");

-- AddForeignKey
ALTER TABLE "property_payos" ADD CONSTRAINT "property_payos_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

