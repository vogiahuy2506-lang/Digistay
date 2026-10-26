-- Hotels choose how guests pay the online deposit: MANUAL (VietQR to the
-- hotel's own account or MoMo wallet, staff confirm) or PAYOS. Nullable
-- columns only: the previous release runs unchanged on this schema (null =
-- PayOS when connected, as before).

-- CreateEnum
CREATE TYPE "DepositPaymentMode" AS ENUM ('MANUAL', 'PAYOS');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "transferClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "depositAccountId" TEXT,
ADD COLUMN     "depositMode" "DepositPaymentMode";

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_depositAccountId_fkey" FOREIGN KEY ("depositAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
