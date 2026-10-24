-- Card payments through each hotel's own SePay payment gateway account
-- (src/lib/payments/sepay.ts). New table and enum value: the previous release
-- never reads either.
-- AlterEnum
ALTER TYPE "PaymentGateway" ADD VALUE 'SEPAY';

-- CreateTable
CREATE TABLE "property_sepay" (
    "propertyId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "verifiedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_sepay_pkey" PRIMARY KEY ("propertyId")
);

-- AddForeignKey
ALTER TABLE "property_sepay" ADD CONSTRAINT "property_sepay_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

