-- Plan overage (src/lib/billing/overage.ts): when a workspace uses more than
-- its plan allows, a 7-day grace starts (overLimitSince); after it the excess
-- is locked, newest first. Nullable columns only: the previous release runs
-- on this schema unchanged.

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "planLockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "room_types" ADD COLUMN     "planLockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "overLimitSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "planLockedAt" TIMESTAMP(3);
