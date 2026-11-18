-- AlterTable website_blocks: Add layoutVariant field
ALTER TABLE "website_blocks" ADD COLUMN IF NOT EXISTS "layoutVariant" TEXT NOT NULL DEFAULT 'default';

-- AlterTable website_settings: Add backgroundColor, themePreset, lastAiPrompt fields
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT DEFAULT '#FFFFFF';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "themePreset" TEXT DEFAULT 'modern_clean';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "lastAiPrompt" TEXT;
