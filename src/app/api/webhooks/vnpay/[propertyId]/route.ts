import { NextRequest, NextResponse } from 'next/server'
import { handleVnpayIpn } from '@/lib/payments/vnpay'

type Props = { params: Promise<{ propertyId: string }> }

async function processVnpayRequest(request: NextRequest, propertyId: string) {
  const url = new URL(request.url)
  const params: Record<string, string> = {}

  // Extract from query params
  url.searchParams.forEach((val, key) => {
    params[key] = val
  })

  // If POST, also merge body params if available
  if (request.method === 'POST') {
    try {
      const contentType = request.headers.get('content-type') || ''
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData()
        formData.forEach((val, key) => {
          if (typeof val === 'string') params[key] = val
        })
      } else if (contentType.includes('application/json')) {
        const json = await request.json()
        Object.entries(json).forEach(([k, v]) => {
          if (typeof v === 'string' || typeof v === 'number') params[k] = String(v)
        })
      }
    } catch {
      // Ignore body read errors, query params might still exist
    }
  }

  const result = await handleVnpayIpn(propertyId, params)
  return NextResponse.json({ RspCode: result.rspCode, Message: result.message })
}

export async function GET(request: NextRequest, props: Props) {
  const { propertyId } = await props.params
  return processVnpayRequest(request, propertyId)
}

export async function POST(request: NextRequest, props: Props) {
  const { propertyId } = await props.params
  return processVnpayRequest(request, propertyId)
}

