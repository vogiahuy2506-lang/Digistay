-- The guest's language ('vi' | 'en'), the page they booked on: their emails follow it.
ALTER TABLE "bookings" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'vi';
