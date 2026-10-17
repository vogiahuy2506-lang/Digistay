/**
 * Email service for Digistay.
 *
 * Backed by Resend (https://resend.com) — a simple transactional email API
 * that works without a separate SMTP server.
 *
 * All functions are no-ops when `RESEND_API_KEY` is not configured, so the
 * app can be developed locally without a key. The functions return a
 * `sent: false` flag in that case so callers can show a "would-have-sent"
 * state in the UI during development.
 */
import { Resend } from 'resend'
import { renderBookingConfirmation } from './templates/booking-confirmation'
import { renderOwnerNewBooking } from './templates/owner-new-booking'
import { renderWorkspaceInvite } from './templates/workspace-invite'
import { renderInvoiceEmail } from './templates/invoice-email'

export interface EmailRecipient {
  email: string
  name?: string
}

export interface SendResult {
  success: boolean
  sent: boolean
  id?: string
  error?: string
}

const apiKey = process.env.RESEND_API_KEY
const fromAddress = process.env.EMAIL_FROM ?? 'Digistay <noreply@digistay.vn>'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const resend = apiKey ? new Resend(apiKey) : null

async function send(
  to: EmailRecipient,
  subject: string,
  html: string,
  text?: string
): Promise<SendResult> {
  if (!resend) {
    // Dev fallback: log to console so developers can see the email.
    console.log(
      `[email:dev] Would send "${subject}" to ${to.email}\n` +
        `--- TEXT ---\n${text ?? stripHtml(html)}\n---`
    )
    return { success: true, sent: false, error: 'RESEND_API_KEY not configured' }
  }
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: to.email,
      subject,
      html,
      text,
    })
    if (result.error) {
      console.error('[email] Send error:', result.error)
      return { success: false, sent: false, error: result.error.message }
    }
    return { success: true, sent: true, id: result.data?.id }
  } catch (err) {
    console.error('[email] Unexpected error:', err)
    return {
      success: false,
      sent: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================
//  Booking confirmation (#29)
// ============================================

export interface BookingConfirmationData {
  guestName: string
  guestEmail: string
  bookingCode: string
  propertyName: string
  propertyAddress: string
  propertyPhone: string | null
  checkIn: string // ISO date
  checkOut: string
  numAdults: number
  numChildren: number
  totalAmount: number
  currency?: string
  manageUrl: string
}

export async function sendBookingConfirmation(
  data: BookingConfirmationData
): Promise<SendResult> {
  const { guestName, guestEmail, bookingCode, propertyName } = data
  const subject = `[${bookingCode}] Xác nhận đặt phòng tại ${propertyName}`
  const html = renderBookingConfirmation({ ...data, siteUrl })
  const text = stripHtml(html)
  return send({ email: guestEmail, name: guestName }, subject, html, text)
}

// ============================================
//  Owner new-booking notification (#30)
// ============================================

export interface OwnerNewBookingData {
  ownerEmail: string
  ownerName?: string
  bookingCode: string
  guestName: string
  guestPhone: string
  guestEmail: string
  propertyName: string
  checkIn: string
  checkOut: string
  totalAmount: number
  currency?: string
  manageUrl: string
}

export async function sendOwnerNewBooking(
  data: OwnerNewBookingData
): Promise<SendResult> {
  const subject = `🔔 Đơn đặt phòng mới #${data.bookingCode} - ${data.propertyName}`
  const html = renderOwnerNewBooking({ ...data, siteUrl })
  const text = stripHtml(html)
  return send({ email: data.ownerEmail, name: data.ownerName }, subject, html, text)
}

// ============================================
//  Workspace invitation (#4)
// ============================================

export interface WorkspaceInviteData {
  recipientEmail: string
  recipientName?: string
  inviterName: string
  workspaceName: string
  role: string
  inviteUrl: string
  expiresAt: Date
}

export async function sendWorkspaceInvite(
  data: WorkspaceInviteData
): Promise<SendResult> {
  const subject = `${data.inviterName} mời bạn tham gia ${data.workspaceName} trên Digistay`
  const html = renderWorkspaceInvite({ ...data, siteUrl })
  const text = stripHtml(html)
  return send({ email: data.recipientEmail, name: data.recipientName }, subject, html, text)
}

// ============================================
//  Invoice email (#39)
// ============================================

export interface InvoiceEmailData {
  customerEmail: string
  customerName: string
  invoiceNumber: string
  bookingCode: string
  propertyName: string
  totalAmount: number
  taxAmount: number
  pdfUrl: string
  xmlUrl?: string
  currency?: string
}

export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<SendResult> {
  const subject = `[${data.invoiceNumber}] Hóa đơn điện tử từ ${data.propertyName}`
  const html = renderInvoiceEmail({ ...data, siteUrl })
  const text = stripHtml(html)
  return send(
    { email: data.customerEmail, name: data.customerName },
    subject,
    html,
    text
  )
}
