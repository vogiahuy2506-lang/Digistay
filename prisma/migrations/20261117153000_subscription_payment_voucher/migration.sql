-- AlterTable subscription_payments: Add voucherCode and discountAmount fields
ALTER TABLE "subscription_payments" ADD COLUMN IF NOT EXISTS "voucherCode" TEXT;
ALTER TABLE "subscription_payments" ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER;
