import { NextRequest, NextResponse } from 'next/server'
import { handleSepayWebhook } from '@/lib/payments/sepay'

type Props = { params: Promise<{ propertyId: string }> }

/**
 * SePay transaction webhook endpoint.
 * Called by SePay server upon incoming bank transfers.
 */
export async function POST(request: NextRequest, props: Props) {
  const { propertyId } = await props.params
  const authHeader = request.headers.get('authorization')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await handleSepayWebhook(propertyId, authHeader, body as Parameters<typeof handleSepayWebhook>[2])
  return NextResponse.json({ success: result.status === 200, outcome: result.outcome }, { status: result.status })
}

