-- CreateTable
CREATE TABLE "ical_sync_feeds" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'AIRBNB',
    "importUrl" TEXT,
    "exportToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ical_sync_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ical_sync_feeds_exportToken_key" ON "ical_sync_feeds"("exportToken");

-- CreateIndex
CREATE INDEX "ical_sync_feeds_propertyId_idx" ON "ical_sync_feeds"("propertyId");

-- CreateIndex
CREATE INDEX "ical_sync_feeds_roomTypeId_idx" ON "ical_sync_feeds"("roomTypeId");

-- AddForeignKey
ALTER TABLE "ical_sync_feeds" ADD CONSTRAINT "ical_sync_feeds_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ical_sync_feeds" ADD CONSTRAINT "ical_sync_feeds_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

