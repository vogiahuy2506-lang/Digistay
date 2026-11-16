-- AlterTable bookings: Add guest identity fields for temporary residence registration
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guestIdType" TEXT DEFAULT 'CCCD';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guestIdNumber" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guestNationality" TEXT DEFAULT 'Việt Nam';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guestBirthDate" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guestGender" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guestAddress" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "stayGuests" JSONB;

-- AlterTable customer_profiles: Add guest identity fields
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "nationality" TEXT DEFAULT 'Việt Nam';
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "gender" TEXT;
