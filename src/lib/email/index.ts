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
import {
  otpEmailTemplate,
  welcomeEmailTemplate,
  passwordChangedTemplate,
  emailChangeTemplate,
  bookingConfirmationTemplate,
  workspaceInviteTemplate,
  invoiceEmailTemplate,
  type OtpEmailTemplateProps,
  type BookingConfirmationTemplateProps,
  type WorkspaceInviteTemplateProps,
} from './templates'

export interface EmailRecipient {
  email: string
  name?: string
}

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
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

// Every caller passes (subject, text, html): the parameters used to be
// declared the other way round, so the HTML part of every email carried the
// plain text and the templates never showed.
async function send(
  to: EmailRecipient,
  subject: string,
  text: string,
  html: string = text,
  attachments: EmailAttachment[] = []
): Promise<SendResult> {
  const from = getFromAddress()
  const plain = text

  const transport = await getTransport()

  // --- Stub: log to console ---
  // The body may hold one-time codes or links, so it is only printed in
  // development; production logs must never contain them.
  if (transport.mode === 'stub') {
    const body =
      process.env.NODE_ENV === 'development' ? plain : '(body hidden outside development)'
    console.log(
      `[email:stub] Would send "${subject}" from ${from} to ${to.email}\n` +
        `--- TEXT ---\n${body}\n---`
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
        ...(attachments.length > 0 && { attachments }),
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
        ...(attachments.length > 0 && {
          attachments: attachments.map(({ filename, content }) => ({ filename, content })),
        }),
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

export type BookingConfirmationData = BookingConfirmationTemplateProps

export async function sendBookingConfirmation(
  data: BookingConfirmationData
): Promise<SendResult> {
  const { html, text, subject } = bookingConfirmationTemplate(data)
  return send({ email: data.guestEmail, name: data.guestName }, subject, text, html)
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
  const subject = `Đơn đặt phòng mới #${data.bookingCode} - ${data.propertyName}`
  const text = `Đơn đặt phòng: ${data.bookingCode}\nKhách: ${data.guestName}\nNgày: ${data.checkIn} - ${data.checkOut}`
  return send({ email: data.ownerEmail, name: data.ownerName }, subject, text, text)
}

// ============================================
//  Workspace invitation
// ============================================

export type WorkspaceInviteData = WorkspaceInviteTemplateProps

export async function sendWorkspaceInvite(
  data: WorkspaceInviteData
): Promise<SendResult> {
  const { html, text, subject } = workspaceInviteTemplate(data)
  return send({ email: data.recipientEmail, name: data.recipientName }, subject, text, html)
}

// ============================================
//  OTP verification (email-based)
// ============================================

export type OtpEmailData = OtpEmailTemplateProps

export async function sendOtpEmail(data: OtpEmailData): Promise<SendResult> {
  const { html, text, subject } = otpEmailTemplate(data)
  return send({ email: data.recipientEmail, name: data.recipientName }, subject, text, html)
}

// ============================================
//  Welcome (after email verified)
// ============================================
export function sendWelcomeEmail(props: { recipientEmail: string; recipientName?: string; loginUrl?: string }): Promise<SendResult> {
  const { html, text, subject } = welcomeEmailTemplate(props)
  return send({ email: props.recipientEmail, name: props.recipientName }, subject, text, html)
}

// ============================================
//  Password changed notification
// ============================================
export function sendPasswordChangedEmail(props: { recipientEmail: string; recipientName?: string; supportUrl?: string }): Promise<SendResult> {
  const { html, text, subject } = passwordChangedTemplate(props)
  return send({ email: props.recipientEmail, name: props.recipientName }, subject, text, html)
}

// ============================================
//  Email change verification link
// ============================================
export function sendEmailChangeEmail(props: { recipientEmail: string; recipientName?: string; newEmail: string; changeUrl: string; expiresInHours?: number }): Promise<SendResult> {
  const { html, text, subject } = emailChangeTemplate(props)
  return send({ email: props.recipientEmail, name: props.recipientName }, subject, text, html)
}

// ============================================
//  Invoice email
// ============================================

export interface InvoiceEmailData {
  to: string
  customerName: string
  einvoiceNumber: string
  series: string
  lookupCode: string
  bookingCode: string
  propertyName: string
  totalAmount: number
  taxAmount: number
  /** e.g. "Điều chỉnh giảm cho hoá đơn số 12" */
  note?: string
  pdf: { filename: string; content: Buffer }
}

/** An issued e-invoice, its PDF attached (src/lib/einvoice/delivery.ts). */
export async function sendInvoiceEmail({ to, pdf, ...data }: InvoiceEmailData): Promise<SendResult> {
  const { html, text, subject } = invoiceEmailTemplate(data)
  return send({ email: to, name: data.customerName }, subject, text, html, [
    { ...pdf, contentType: 'application/pdf' },
  ])
}
