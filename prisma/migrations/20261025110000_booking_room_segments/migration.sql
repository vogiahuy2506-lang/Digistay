-- A stay split between rooms (src/lib/bookings/rooms.ts): which room each part of the
-- stay is in. New table only: the previous release never reads it, and a stay in one
-- room has no rows.
-- CreateTable
CREATE TABLE "booking_room_segments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "roomId" TEXT,
    "roomNumber" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_room_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_room_segments_bookingId_idx" ON "booking_room_segments"("bookingId");

-- CreateIndex
CREATE INDEX "booking_room_segments_roomId_idx" ON "booking_room_segments"("roomId");

-- CreateIndex
CREATE INDEX "booking_room_segments_roomTypeId_idx" ON "booking_room_segments"("roomTypeId");

-- AddForeignKey
ALTER TABLE "booking_room_segments" ADD CONSTRAINT "booking_room_segments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_room_segments" ADD CONSTRAINT "booking_room_segments_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
