-- AlterTable users: Add termsAcceptedAt field
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

-- Existing accounts created with a password already agreed on the registration form
UPDATE "users" SET "termsAcceptedAt" = "createdAt" WHERE "password" IS NOT NULL AND "termsAcceptedAt" IS NULL;
