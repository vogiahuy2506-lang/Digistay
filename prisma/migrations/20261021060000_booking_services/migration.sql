-- The services chosen with a booking (src/lib/bookings/create-booking.ts). Additive.
-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "services" JSONB;
