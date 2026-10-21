-- Minutes a guest has to pay the online deposit before the booking is cancelled (0 = never).
ALTER TABLE "policies" ADD COLUMN "depositDeadlineMinutes" INTEGER NOT NULL DEFAULT 0;
