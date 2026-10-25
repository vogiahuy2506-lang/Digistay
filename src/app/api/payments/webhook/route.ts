import { NextResponse } from 'next/server'

/**
 * POST /api/payments/webhook — DISABLED.
 *
 * The previous version had its signature check commented out, so anyone
 * could post a fake "payment.success" and confirm a booking. It also had an
 * unauthenticated PUT that marked any payment PAID by id. No real payment
 * gateway calls this route, so disabling it loses no functionality.
 *
 * A verified webhook comes back in Part 5 (PayOS, one key set per
 * property, signature checked before anything else). Until then, staff
 * confirm bank transfers via POST /api/payments/[id]/confirm.
 */
export async function POST() {
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
}
