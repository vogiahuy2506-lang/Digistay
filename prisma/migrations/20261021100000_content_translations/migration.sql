-- The hotel's own texts in English (property, room types, services, policy, SEO): { "en": { ... } }.
-- Nullable, nothing to backfill: without them the Vietnamese shows.
ALTER TABLE "properties" ADD COLUMN "translations" JSONB;
ALTER TABLE "room_types" ADD COLUMN "translations" JSONB;
ALTER TABLE "extra_services" ADD COLUMN "translations" JSONB;
ALTER TABLE "policies" ADD COLUMN "translations" JSONB;
ALTER TABLE "website_settings" ADD COLUMN "translations" JSONB;

-- The seed named the "safe" amenity " сейф" (Russian, with a space): give it its Vietnamese name.
UPDATE "amenities" SET "name" = 'Két sắt' WHERE "slug" = 'safe' AND "name" = ' сейф';
