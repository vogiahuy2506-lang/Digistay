-- The services page and API have always sent a category (laundry, transport,
-- food, entertainment, other) that the table had no column for, so creating
-- or editing a service failed.
ALTER TABLE "extra_services" ADD COLUMN "category" TEXT;
