-- SePay removed (owner's decision, 2026-10-25): PayOS is the only payment
-- gateway. property_sepay held each hotel's SePay connection (merchant ID and
-- encrypted secret key), added by 20261024140000_sepay. The previous release
-- (be9b8b7, which removed SePay's code) never reads it, so it goes now, one
-- release later (CLAUDE.md: a migration must work with the previous release).
-- Payments are not touched: rows with paymentGateway SEPAY stay, and so does
-- the enum value.
-- destructive-ok: property_sepay only held SePay connection keys, useless once card payments are gone; no table references it and neither this release nor the previous one reads it.
-- DropForeignKey
ALTER TABLE "property_sepay" DROP CONSTRAINT "property_sepay_propertyId_fkey";

-- DropTable
DROP TABLE "property_sepay";
