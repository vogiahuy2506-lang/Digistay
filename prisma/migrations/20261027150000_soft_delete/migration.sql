-- Soft delete of properties and workspaces (src/lib/deletion): restorable for
-- 30 days, then removed by /api/internal/purge-deleted. Nullable columns only,
-- so the previous release runs on it (it just never sets them).

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "workspaces_deletedAt_idx" ON "workspaces"("deletedAt");

-- CreateIndex
CREATE INDEX "properties_deletedAt_idx" ON "properties"("deletedAt");
