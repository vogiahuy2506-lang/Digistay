-- When the owner was told about the free trial (shown once per workspace).
ALTER TABLE "subscriptions" ADD COLUMN "trialWelcomedAt" TIMESTAMP(3);
