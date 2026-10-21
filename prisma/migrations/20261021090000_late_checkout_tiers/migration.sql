-- The hotel's late check-out tiers (null = the default 30% / 50% / 100%; [] = no late fee).
ALTER TABLE "policies" ADD COLUMN "lateCheckoutTiers" JSONB;
