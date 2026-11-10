import { NextRequest } from 'next/server'
import { generateIcalExportFeed } from '@/lib/ota/ical-sync'

/**
 * Public endpoint to export iCalendar feed (.ics) for OTAs (Airbnb, Booking.com, VRBO, etc.).
 * GET /api/channels/ical/export/[token]
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params
  const { token } = params

  if (!token || typeof token !== 'string') {
    return new Response('Invalid export token', { status: 400 })
  }

  const result = await generateIcalExportFeed(token)
  if (!result) {
    return new Response('Calendar feed not found or inactive', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(result.ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="digistay-calendar.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

