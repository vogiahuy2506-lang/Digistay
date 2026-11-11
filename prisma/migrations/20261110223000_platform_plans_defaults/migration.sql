-- AlterTable platform_plans: set defaults on properties, rooms, staff to match schema
ALTER TABLE "platform_plans" ALTER COLUMN "properties" SET DEFAULT 1;
ALTER TABLE "platform_plans" ALTER COLUMN "rooms" SET DEFAULT 15;
ALTER TABLE "platform_plans" ALTER COLUMN "staff" SET DEFAULT 3;
