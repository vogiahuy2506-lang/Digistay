import { prisma } from '@/lib/db'

export interface ParsedIcalEvent {
  uid: string
  start: Date
  end: Date
  summary: string
  description?: string
  status?: string
}

/** Formats a Date to YYYYMMDD in UTC */
export function formatIcalDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** Formats a Date to YYYYMMDDTHHMMSSZ */
export function formatIcalDateTime(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}${s}Z`
}

/** Parses raw string date format YYYYMMDD or YYYYMMDDTHHMMSSZ into a Date object */
export function parseIcalRawDate(raw: string): Date | null {
  const clean = raw.trim().replace(/^VALUE=DATE:/i, '')
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10)
    const m = parseInt(clean.slice(4, 6), 10) - 1
    const d = parseInt(clean.slice(6, 8), 10)
    return new Date(Date.UTC(y, m, d, 0, 0, 0))
  }
  if (/^\d{8}T\d{6}Z?$/i.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10)
    const m = parseInt(clean.slice(4, 6), 10) - 1
    const d = parseInt(clean.slice(6, 8), 10)
    const h = parseInt(clean.slice(9, 11), 10)
    const min = parseInt(clean.slice(11, 13), 10)
    const s = parseInt(clean.slice(13, 15), 10)
    return new Date(Date.UTC(y, m, d, h, min, s))
  }
  return null
}

/**
 * Parses standard iCalendar (.ics) format string into structured events.
 */
export function parseIcalString(icsText: string): ParsedIcalEvent[] {
  const events: ParsedIcalEvent[] = []
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Unfold multi-line iCal properties (lines starting with space or tab)
  const unfolded: string[] = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else {
      unfolded.push(line)
    }
  }

  let inEvent = false
  let curEvent: Partial<ParsedIcalEvent> = {}

  for (const line of unfolded) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true
      curEvent = {}
      continue
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && curEvent.uid && curEvent.start && curEvent.end) {
        events.push({
          uid: curEvent.uid,
          start: curEvent.start,
          end: curEvent.end,
          summary: curEvent.summary || 'Đã đặt qua sàn OTA (iCal)',
          description: curEvent.description,
          status: curEvent.status,
        })
      }
      inEvent = false
      continue
    }

    if (!inEvent) continue

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const propNameWithParams = trimmed.slice(0, colonIdx)
    const propValue = trimmed.slice(colonIdx + 1)
    const propName = propNameWithParams.split(';')[0].toUpperCase()

    switch (propName) {
      case 'UID':
        curEvent.uid = propValue
        break
      case 'SUMMARY':
        curEvent.summary = propValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n')
        break
      case 'DESCRIPTION':
        curEvent.description = propValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n')
        break
      case 'DTSTART': {
        const parsed = parseIcalRawDate(propValue)
        if (parsed) curEvent.start = parsed
        break
      }
      case 'DTEND': {
        const parsed = parseIcalRawDate(propValue)
        if (parsed) curEvent.end = parsed
        break
      }
      case 'STATUS':
        curEvent.status = propValue.toUpperCase()
        break
    }
  }

  return events
}

/**
 * Generates RFC 5545 iCalendar content for a feed export token.
 */
export async function generateIcalExportFeed(exportToken: string): Promise<{ ics: string; feedName: string } | null> {
  const feed = await prisma.icalSyncFeed.findUnique({
    where: { exportToken },
    include: {
      property: { select: { name: true, id: true } },
      roomType: { select: { name: true, id: true } },
    },
  })

  if (!feed || !feed.isActive) {
    return null
  }

  const now = new Date()
  const past30Days = new Date(now.getTime() - 30 * 24 * 3600_000)

  // 1. Fetch active bookings for this room type
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId: feed.propertyId,
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      checkOutDate: { gte: past30Days },
      bookingItems: {
        some: { roomTypeId: feed.roomTypeId },
      },
    },
    select: {
      id: true,
      bookingCode: true,
      guestName: true,
      checkInDate: true,
      checkOutDate: true,
      createdAt: true,
      source: true,
    },
  })

  // 2. Fetch manual blocked periods / maintenance
  const locks = await prisma.roomLock.findMany({
    where: {
      propertyId: feed.propertyId,
      roomTypeId: feed.roomTypeId,
      type: { in: ['BLOCKED', 'MAINTENANCE'] },
      lockEnd: { gte: past30Days },
    },
    select: {
      id: true,
      lockStart: true,
      lockEnd: true,
      notes: true,
      type: true,
      createdAt: true,
    },
  })

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Digistay PMS//iCal Sync 1.0//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Digistay - ${feed.property.name} - ${feed.roomType.name}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ]

  // Add Bookings
  for (const b of bookings) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:booking-${b.id}@digistay.vn`,
      `DTSTAMP:${formatIcalDateTime(b.createdAt)}`,
      `DTSTART;VALUE=DATE:${formatIcalDate(b.checkInDate)}`,
      `DTEND;VALUE=DATE:${formatIcalDate(b.checkOutDate)}`,
      `SUMMARY:Digistay Đặt phòng ${b.bookingCode || b.id.slice(0, 8)}`,
      `DESCRIPTION:Đặt phòng qua Digistay (${b.source}) - Khách: ${b.guestName || 'Khách lưu trú'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    )
  }

  // Add Manual Blocks / Maintenance
  for (const l of locks) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:lock-${l.id}@digistay.vn`,
      `DTSTAMP:${formatIcalDateTime(l.createdAt)}`,
      `DTSTART;VALUE=DATE:${formatIcalDate(l.lockStart)}`,
      `DTEND;VALUE=DATE:${formatIcalDate(l.lockEnd)}`,
      `SUMMARY:${l.type === 'MAINTENANCE' ? 'Bảo trì phòng' : 'Khóa phòng thủ công'}`,
      `DESCRIPTION:${l.notes || 'Chặn phòng trên Digistay'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')

  return {
    ics: lines.join('\r\n'),
    feedName: `${feed.property.name} - ${feed.roomType.name}`,
  }
}

/**
 * Synchronizes an iCal feed by pulling external events and updating RoomLock.
 */
export async function syncIcalFeed(feedId: string): Promise<{
  success: boolean
  eventsCount: number
  error?: string
}> {
  const feed = await prisma.icalSyncFeed.findUnique({
    where: { id: feedId },
    include: {
      property: { select: { id: true, name: true } },
      roomType: { select: { id: true, name: true } },
    },
  })

  if (!feed) {
    return { success: false, eventsCount: 0, error: 'Không tìm thấy liên kết iCal' }
  }

  if (!feed.importUrl || !feed.importUrl.trim()) {
    return { success: false, eventsCount: 0, error: 'Chưa cấu hình URL nhập lịch iCal' }
  }

  try {
    const res = await fetch(feed.importUrl.trim(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Digistay-iCal-Sync/1.0; +https://digistay.vn)',
      },
    })

    if (!res.ok) {
      const err = `Lỗi tải file iCal từ sàn: HTTP ${res.status}`
      await prisma.icalSyncFeed.update({
        where: { id: feedId },
        data: { lastError: err },
      })
      return { success: false, eventsCount: 0, error: err }
    }

    const icsText = await res.text()
    const events = parseIcalString(icsText)

    // Filter out past events
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const activeEvents = events.filter((e) => e.end >= today)

    // Transaction to update RoomLocks for this feed
    await prisma.$transaction(async (tx) => {
      // 1. Delete previous room locks for this feed session prefix
      await tx.roomLock.deleteMany({
        where: {
          propertyId: feed.propertyId,
          roomTypeId: feed.roomTypeId,
          sessionId: { startsWith: `ical-${feed.id}-` },
        },
      })

      // 2. Insert new locks for each active event
      for (const event of activeEvents) {
        await tx.roomLock.create({
          data: {
            propertyId: feed.propertyId,
            roomTypeId: feed.roomTypeId,
            lockStart: event.start,
            lockEnd: event.end,
            type: 'BLOCKED',
            sessionId: `ical-${feed.id}-${event.uid}`,
            customerInfo: `iCal: ${feed.channel}`,
            notes: `${event.summary || 'Đã đặt trên sàn'} (${feed.channel})`,
          },
        })
      }

      // 3. Update feed status
      await tx.icalSyncFeed.update({
        where: { id: feedId },
        data: {
          lastSyncedAt: new Date(),
          lastError: null,
          eventsCount: activeEvents.length,
        },
      })
    })

    return { success: true, eventsCount: activeEvents.length }
  } catch (error: any) {
    console.error('[iCal Sync Error]:', error)
    const msg = error?.message || 'Không thể đồng bộ lịch từ sàn'
    await prisma.icalSyncFeed.update({
      where: { id: feedId },
      data: { lastError: msg },
    }).catch(() => {})
    return { success: false, eventsCount: 0, error: msg }
  }
}

