-- Upgrade Extra Services and Property Amenities (Tasks 51-55)
-- Add visual fields, lead time, booking display options and featured amenity markers.

-- AlterTable extra_services
ALTER TABLE "extra_services" ADD COLUMN "coverImage" TEXT;
ALTER TABLE "extra_services" ADD COLUMN "leadTimeHours" INTEGER DEFAULT 0;
ALTER TABLE "extra_services" ADD COLUMN "dailyCapacity" INTEGER;
ALTER TABLE "extra_services" ADD COLUMN "operatingHours" TEXT;
ALTER TABLE "extra_services" ADD COLUMN "showOnBooking" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "extra_services" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- AlterTable property_amenities
ALTER TABLE "property_amenities" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "property_amenities" ADD COLUMN "customName" TEXT;
ALTER TABLE "property_amenities" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "property_amenities" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
