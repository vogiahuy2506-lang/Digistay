-- Refund suggested when a guest cancels inside the free-cancellation window,
-- in % of what was paid (src/lib/bookings/cancel-refund.ts); 0 = nothing.
ALTER TABLE "policies" ADD COLUMN "lateCancelRefundPercent" INTEGER NOT NULL DEFAULT 0;
