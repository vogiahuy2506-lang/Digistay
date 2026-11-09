-- AlterEnum
ALTER TYPE "DepositPaymentMode" ADD VALUE 'SEPAY';
ALTER TYPE "DepositPaymentMode" ADD VALUE 'MOMO';
ALTER TYPE "DepositPaymentMode" ADD VALUE 'VNPAY';

-- CreateTable
CREATE TABLE "property_sepay" (
    "propertyId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "webhookToken" TEXT,
    "accountNumber" TEXT,
    "bankCode" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_sepay_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "property_momo" (
    "propertyId" TEXT NOT NULL,
    "partnerCode" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_momo_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "property_vnpay" (
    "propertyId" TEXT NOT NULL,
    "tmnCode" TEXT NOT NULL,
    "hashSecret" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_vnpay_pkey" PRIMARY KEY ("propertyId")
);

-- AddForeignKey
ALTER TABLE "property_sepay" ADD CONSTRAINT "property_sepay_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_momo" ADD CONSTRAINT "property_momo_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_vnpay" ADD CONSTRAINT "property_vnpay_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

