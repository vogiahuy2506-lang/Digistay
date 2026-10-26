-- Version history of a hotel's website (the builder keeps one per save, restore puts one back).
-- A new table and type only: the previous release never reads them.
-- CreateEnum
CREATE TYPE "SiteVersionKind" AS ENUM ('AUTO', 'RESTORE', 'BEFORE_RESTORE', 'INITIAL');

-- CreateTable
CREATE TABLE "site_versions" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" "SiteVersionKind" NOT NULL DEFAULT 'AUTO',
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "restoredFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_versions_propertyId_createdAt_idx" ON "site_versions"("propertyId", "createdAt");

-- AddForeignKey
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
