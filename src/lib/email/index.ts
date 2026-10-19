/**
 * Email service for Digistay.
 *
 * Supported transports (chosen at runtime based on env):
 *   1. SMTP via nodemailer — when EMAIL_SERVER_HOST is set
 *   2. Resend — when RESEND_API_KEY is set
 *   3. Stub — logs to console (dev / unconfigured)
 *
 * Priority: SMTP > Resend > Stub.
 */

import nodemailer, { type Transporter } from 'nodemailer'

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

// ============================================
//  Transport selection
// ============================================

let cachedTransport: Transporter | null = null
let transportMode: 'smtp' | 'resend' | 'stub' = 'stub'

function buildSmtpTransport(): Transporter | null {
  const host = process.env.EMAIL_SERVER_HOST
  const port = process.env.EMAIL_SERVER_PORT
  const user = process.env.EMAIL_SERVER_USER
  const pass = process.env.EMAIL_SERVER_PASSWORD

  if (!host || !port || !user || !pass) return null

  const portNum = Number(port)
  const isSecure = portNum === 465

  return nodemailer.createTransport({
    host,
    port: portNum,
    secure: isSecure, // true for 465, false for 587 (STARTTLS)
    auth: { user, pass },
    tls: {
      // Required when using self-signed certs on internal SMTP
      rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
  })
}

async function buildResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  // Lazy import to avoid bundling when unused
  const { Resend } = await import('resend')
  return new Resend(apiKey)
}

async function getTransport(): Promise<
  | { mode: 'smtp'; smtp: Transporter }
  | { mode: 'resend'; resend: Awaited<ReturnType<typeof buildResendClient>> }
  | { mode: 'stub' }
> {
  if (process.env.EMAIL_SERVER_HOST) {
    if (!cachedTransport) {
      cachedTransport = buildSmtpTransport()
    }
    if (cachedTransport) {
      transportMode = 'smtp'
      return { mode: 'smtp', smtp: cachedTransport }
    }
  }

  const resend = await buildResendClient()
  if (resend) {
    transportMode = 'resend'
    return { mode: 'resend', resend }
  }

  transportMode = 'stub'
  return { mode: 'stub' }
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? 'Digistay <noreply@digistay.vn>'
}

async function send(
  to: EmailRecipient,
  subject: string,
  html: string,
  text?: string
): Promise<SendResult> {
  const from = getFromAddress()
  const plain = text ?? html

  const transport = await getTransport()

  // --- Stub: log to console ---
  if (transport.mode === 'stub') {
    console.log(
      `[email:stub] Would send "${subject}" from ${from} to ${to.email}\n` +
        `--- TEXT ---\n${plain}\n---`
    )
    return { success: true, sent: false, error: 'Email service not configured' }
  }

  // --- SMTP ---
  if (transport.mode === 'smtp') {
    try {
      const info = await transport.smtp.sendMail({
        from,
        to: to.name ? `"${to.name}" <${to.email}>` : to.email,
        subject,
        text: plain,
        html,
      })
      return { success: true, sent: true, id: info.messageId }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown SMTP error'
      console.error(`[email:smtp] Failed to send to ${to.email}: ${message}`)
      return { success: false, sent: false, error: message }
    }
  }

  // --- Resend ---
  if (transport.mode === 'resend' && transport.resend) {
    try {
      const result = await transport.resend.emails.send({
        from,
        to: to.email,
        subject,
        text: plain,
        html,
      })
      if (result.error) {
        return { success: false, sent: false, error: result.error.message }
      }
      return { success: true, sent: true, id: result.data?.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Resend error'
      console.error(`[email:resend] Failed to send to ${to.email}: ${message}`)
      return { success: false, sent: false, error: message }
    }
  }

  return { success: false, sent: false, error: 'No transport available' }
}

// ============================================
//  Booking confirmation
// ============================================

export interface BookingConfirmationData {
  guestName: string
  guestEmail: string
  bookingCode: string
  propertyName: string
  propertyAddress: string
  propertyPhone: string | null
  checkIn: string
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
  const subject = `[${bookingCode}] Xac nhan dat phong tai ${propertyName}`
  const text = `Xac nhan dat phong: ${bookingCode}\nKhach san: ${propertyName}\nNgay: ${data.checkIn} - ${data.checkOut}`
  return send({ email: guestEmail, name: guestName }, subject, text, text)
}

// ============================================
//  Owner new-booking notification
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
  const subject = `Don dat phong moi #${data.bookingCode} - ${data.propertyName}`
  const text = `Don dat phong: ${data.bookingCode}\nKhach: ${data.guestName}\nNgay: ${data.checkIn} - ${data.checkOut}`
  return send({ email: data.ownerEmail, name: data.ownerName }, subject, text, text)
}

// ============================================
//  Workspace invitation
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
  const subject = `${data.inviterName} moi ban tham gia ${data.workspaceName}`
  const text = `Loi moi tu: ${data.inviterName}\nWorkspace: ${data.workspaceName}\nVai tro: ${data.role}`
  return send({ email: data.recipientEmail, name: data.recipientName }, subject, text, text)
}

// ============================================
//  Invoice email
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
  const subject = `[${data.invoiceNumber}] Hoa don tu ${data.propertyName}`
  const text = `Hoa don: ${data.invoiceNumber}\nBooking: ${data.bookingCode}\nSo tien: ${data.totalAmount}`
  return send({ email: data.customerEmail, name: data.customerName }, subject, text, text)
}
