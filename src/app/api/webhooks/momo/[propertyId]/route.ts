import { NextRequest, NextResponse } from 'next/server'
import { handleMomoIpn, type MomoIpnPayload } from '@/lib/payments/momo'

type Props = { params: Promise<{ propertyId: string }> }

/**
 * MoMo payment IPN webhook endpoint.
 * Called by MoMo server upon successful or failed payment.
 */
export async function POST(request: NextRequest, props: Props) {
  const { propertyId } = await props.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await handleMomoIpn(propertyId, body as MomoIpnPayload)
  return NextResponse.json({ message: result.outcome }, { status: result.status })
}

