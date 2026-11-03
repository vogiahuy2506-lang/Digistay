-- CreateEnum
CREATE TYPE "DynamicPricingStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OtaChannel" AS ENUM ('AGODA', 'BOOKING_COM', 'AIRBNB', 'TRAVELOKA', 'EXPEDIA');

-- CreateEnum
CREATE TYPE "ChannelSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ChannelSyncDirection" AS ENUM ('OUTBOUND_AVAILABILITY', 'OUTBOUND_RATE', 'INBOUND_BOOKING', 'INBOUND_CANCELLATION');

-- AlterTable bookings
ALTER TABLE "bookings" ADD COLUMN "channelBookingId" TEXT;
ALTER TABLE "bookings" ADD COLUMN "channelMetadata" JSONB;

-- CreateTable dynamic_pricing_suggestions
CREATE TABLE "dynamic_pricing_suggestions" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "suggestedPrice" DOUBLE PRECISION NOT NULL,
    "percentageChange" DOUBLE PRECISION NOT NULL,
    "reasoningVi" TEXT NOT NULL,
    "reasoningEn" TEXT,
    "status" "DynamicPricingStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_pricing_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable channel_accounts
CREATE TABLE "channel_accounts" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channel" "OtaChannel" NOT NULL,
    "hotelIdentifier" TEXT NOT NULL,
    "encryptedConfig" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable channel_room_mappings
CREATE TABLE "channel_room_mappings" (
    "id" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "channelRoomId" TEXT NOT NULL,
    "channelRoomName" TEXT,
    "channelRatePlanId" TEXT,
    "rateMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_room_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable channel_sync_logs
CREATE TABLE "channel_sync_logs" (
    "id" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "direction" "ChannelSyncDirection" NOT NULL,
    "status" "ChannelSyncStatus" NOT NULL,
    "payload" JSONB,
    "response" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_pricing_suggestions_propertyId_roomTypeId_targetDate_key" ON "dynamic_pricing_suggestions"("propertyId", "roomTypeId", "targetDate");
CREATE INDEX "dynamic_pricing_suggestions_propertyId_status_targetDate_idx" ON "dynamic_pricing_suggestions"("propertyId", "status", "targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "channel_accounts_propertyId_channel_key" ON "channel_accounts"("propertyId", "channel");
CREATE INDEX "channel_accounts_propertyId_isActive_idx" ON "channel_accounts"("propertyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "channel_room_mappings_channelAccountId_roomTypeId_key" ON "channel_room_mappings"("channelAccountId", "roomTypeId");
CREATE INDEX "channel_room_mappings_channelAccountId_isSyncEnabled_idx" ON "channel_room_mappings"("channelAccountId", "isSyncEnabled");

-- CreateIndex
CREATE INDEX "channel_sync_logs_channelAccountId_createdAt_idx" ON "channel_sync_logs"("channelAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "bookings_propertyId_channelBookingId_idx" ON "bookings"("propertyId", "channelBookingId");

-- AddForeignKey
ALTER TABLE "dynamic_pricing_suggestions" ADD CONSTRAINT "dynamic_pricing_suggestions_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dynamic_pricing_suggestions" ADD CONSTRAINT "dynamic_pricing_suggestions_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_accounts" ADD CONSTRAINT "channel_accounts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_room_mappings" ADD CONSTRAINT "channel_room_mappings_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_room_mappings" ADD CONSTRAINT "channel_room_mappings_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_logs" ADD CONSTRAINT "channel_sync_logs_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

