-- Deposit a guest pays through PayOS when booking on the hotel's site (% of the total; 0 = none).
ALTER TABLE "policies" ADD COLUMN "onlineDepositPercent" INTEGER NOT NULL DEFAULT 0;
