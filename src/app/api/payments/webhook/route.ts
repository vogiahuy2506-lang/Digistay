import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

// VietQR Webhook signature verification
function verifyVietQRSignature(payload: string, signature: string, secretKey: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-vietqr-signature') || ''
    
    // In production, verify the signature
    // const isValid = verifyVietQRSignature(body, signature, process.env.VIETQR_SECRET_KEY || '')
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const data = JSON.parse(body)

    // VietQR webhook payload structure
    // {
    //   "event": "payment.success",
    //   "data": {
    //     "transactionId": "xxx",
    //     "amount": 1000000,
    //     "description": "DSABC123",
    //     "accountNumber": "123456789",
    //     "bankCode": "MB",
    //     "timestamp": 1234567890
    //   }
    // }

    if (data.event !== 'payment.success') {
      return NextResponse.json({ received: true })
    }

    const { transactionId, amount, description } = data.data

    // Extract booking code from transfer description
    const bookingCodeMatch = description?.match(/DS([A-Z0-9]+)/)
    if (!bookingCodeMatch) {
      console.log('No booking code found in transaction:', description)
      return NextResponse.json({ received: true })
    }

    const bookingCode = bookingCodeMatch[0]

    // Find the pending payment
    const payment = await prisma.payment.findFirst({
      where: {
        transferContent: bookingCode,
        status: 'PENDING',
        amount: parseFloat(amount),
      },
      include: {
        booking: true,
      },
    })

    if (!payment) {
      console.log('No matching payment found for:', bookingCode)
      return NextResponse.json({ received: true })
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        transactionId,
        metadata: data.data,
      },
    })

    // Update booking
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentStatus: 'PAID',
        status: payment.booking.status === 'PENDING' ? 'CONFIRMED' : payment.booking.status,
        depositAmount: payment.amount,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        propertyId: payment.booking.propertyId,
        action: 'UPDATE',
        entityType: 'PAYMENT',
        entityId: payment.id,
        metadata: { 
          event: 'payment.success',
          transactionId,
          bookingCode,
        },
      },
    })

    console.log(`Payment confirmed for booking ${bookingCode}: ${amount}`)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Payment webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Manual payment confirmation endpoint (for testing/admin)
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'Thiếu paymentId' }, { status: 400 })
    }

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: {
        booking: true,
      },
    })

    // Update booking
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentStatus: 'PAID',
        status: payment.booking.status === 'PENDING' ? 'CONFIRMED' : payment.booking.status,
        depositAmount: payment.amount,
      },
    })

    return NextResponse.json({
      success: true,
      data: payment,
      message: 'Xác nhận thanh toán thành công',
    })
  } catch (error) {
    console.error('Confirm payment error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xác nhận thanh toán' }, { status: 500 })
  }
}
