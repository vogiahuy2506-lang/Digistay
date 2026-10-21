/**
 * Emails sent after the request, kept until sent (email_outbox).
 *
 * The booking and invitation emails used to be fire-and-forget: send()
 * reports a failure instead of throwing, so a refused or unconfigured SMTP
 * lost them without a trace. Now the request renders the email and stores
 * it (encrypted: an invitation carries its token), sends it right after the
 * response (after()), and the scheduled job (/api/internal/email-outbox)
 * retries what failed: 10 min, 30 min, 2 h, 6 h, then gives up and the ops
 * alerts say so. One conditional update claims a row, so the fast path and
 * the job never send it twice.
 *
 * Emails the person is waiting for (sign-in codes) stay direct: they need
 * to know at once if it failed.
 */
import { randomUUID } from 'crypto'
import { after } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, secretContext } from '@/lib/security/secret-box'
import { escapeHtml } from '@/lib/utils/escape-html'
import { sendRendered, type EmailRecipient } from './index'
import {
  bookingConfirmationTemplate,
  workspaceInviteTemplate,
  type BookingConfirmationTemplateProps,
  type WorkspaceInviteTemplateProps,
} from './templates'

export const OUTBOX_MAX_ATTEMPTS = 5
const LEASE_MS = 3 * 60 * 1000
const BACKOFF_MS = [10, 30, 120, 360].map((minutes) => minutes * 60 * 1000)
const KEEP_SENT_MS = 30 * 24 * 60 * 60 * 1000

type Kind = 'booking_confirmation' | 'owner_new_booking' | 'workspace_invite' | 'deposit_received' | 'deposit_expired'
interface Message {
  to: EmailRecipient
  subject: string
  text: string
  html: string
}

const messageCtx = (id: string) => secretContext('email_outbox', id, 'message')
type Db = Prisma.TransactionClient | typeof prisma

/** Stores a rendered email for sending; returns its id. */
export async function queueEmail(kind: Kind, message: Message, refId?: string, db: Db = prisma) {
  const id = randomUUID()
  await db.emailOutbox.create({
    data: {
      id,
      kind,
      toEmail: message.to.email,
      message: encryptSecret(JSON.stringify(message), messageCtx(id)),
      refId: refId ?? null,
    },
  })
  return id
}

export function queueBookingConfirmation(data: BookingConfirmationTemplateProps, bookingId: string, db?: Db) {
  return queueEmail('booking_confirmation', { to: { email: data.guestEmail, name: data.guestName }, ...bookingConfirmationTemplate(data) }, bookingId, db)
}

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
  /** the booking in the dashboard */
  manageUrl: string
  /** A request from the hotel's website, waiting for the hotel to confirm. */
  fromWebsite?: boolean
}

export function queueOwnerNewBooking(data: OwnerNewBookingData, bookingId: string, db?: Db) {
  const subject = data.fromWebsite
    ? `Yêu cầu đặt phòng mới từ website #${data.bookingCode} - ${data.propertyName}`
    : `Đơn đặt phòng mới #${data.bookingCode} - ${data.propertyName}`
  const text = [
    ...(data.fromWebsite ? ['Khách đặt qua website, đang chờ bạn xác nhận.'] : []),
    `Đơn đặt phòng: ${data.bookingCode}`,
    `Khách: ${data.guestName} · ${data.guestPhone} · ${data.guestEmail}`,
    `Ngày: ${data.checkIn.slice(0, 10)} - ${data.checkOut.slice(0, 10)}`,
    `Xem đơn: ${data.manageUrl}`,
  ].join('\n')
  // The guest's name and contact come from a public form: escape them for the HTML part.
  const html = escapeHtml(text).replace(/\n/g, '<br/>')
  return queueEmail('owner_new_booking', { to: { email: data.ownerEmail, name: data.ownerName }, subject, text, html }, bookingId, db)
}

export interface DepositReceivedData {
  guestEmail: string
  guestName: string
  bookingCode: string
  propertyName: string
  propertyPhone?: string | null
  checkIn: Date
  checkOut: Date
  deposit: number
  /** still to pay at the hotel */
  remaining: number
}

/** To the guest once PayOS reports their deposit (src/lib/payments/payos.ts): the booking is confirmed. */
export function queueDepositReceived(data: DepositReceivedData, bookingId: string, db?: Db) {
  const day = (d: Date) => d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} ₫`
  const subject = `Đã nhận tiền cọc - đặt phòng #${data.bookingCode} đã được xác nhận`
  const text = [
    `Xin chào ${data.guestName},`,
    '',
    `${data.propertyName} đã nhận ${vnd(data.deposit)} tiền cọc cho đặt phòng ${data.bookingCode}. Đặt phòng của bạn đã được xác nhận.`,
    `Nhận phòng: ${day(data.checkIn)} · Trả phòng: ${day(data.checkOut)}`,
    ...(data.remaining > 0 ? [`Còn lại khi nhận phòng: ${vnd(data.remaining)}`] : []),
    ...(data.propertyPhone ? [`Liên hệ khách sạn: ${data.propertyPhone}`] : []),
  ].join('\n')
  // The guest's name comes from a public form: escape it for the HTML part.
  const html = escapeHtml(text).replace(/\n/g, '<br/>')
  return queueEmail('deposit_received', { to: { email: data.guestEmail, name: data.guestName }, subject, text, html }, bookingId, db)
}

/** To the guest when their unpaid booking is cancelled at the hotel's deposit deadline (guest-deposit.ts). */
export function queueDepositExpired(
  data: { guestEmail: string; guestName: string; bookingCode: string; propertyName: string; propertyPhone?: string | null },
  bookingId: string,
  db?: Db
) {
  const subject = `Đặt phòng #${data.bookingCode} đã được huỷ vì chưa nhận được tiền cọc`
  const text = [
    `Xin chào ${data.guestName},`,
    '',
    `${data.propertyName} chưa nhận được tiền cọc cho đặt phòng ${data.bookingCode} trong thời hạn, nên đặt phòng đã được huỷ và phòng được mở lại cho khách khác.`,
    'Nếu bạn đã chuyển khoản, vui lòng liên hệ khách sạn để được xác nhận lại hoặc hoàn tiền.',
    ...(data.propertyPhone ? [`Liên hệ khách sạn: ${data.propertyPhone}`] : []),
  ].join('\n')
  // The guest's name comes from a public form: escape it for the HTML part.
  const html = escapeHtml(text).replace(/\n/g, '<br/>')
  return queueEmail('deposit_expired', { to: { email: data.guestEmail, name: data.guestName }, subject, text, html }, bookingId, db)
}

export function queueWorkspaceInvite(data: WorkspaceInviteTemplateProps, invitationId: string, db?: Db) {
  return queueEmail('workspace_invite', { to: { email: data.recipientEmail, name: data.recipientName }, ...workspaceInviteTemplate(data) }, invitationId, db)
}

export type OutboxOutcome = 'sent' | 'failed' | 'not-due'

/** Sends one queued email if it is due. Safe to call any number of times. */
export async function sendQueuedEmail(id: string, now = new Date()): Promise<{ outcome: OutboxOutcome; error?: string }> {
  const claimed = await prisma.emailOutbox.updateMany({
    where: {
      id,
      OR: [{ status: 'PENDING' }, { status: { in: ['FAILED', 'SENDING'] }, nextAt: { lte: now } }],
    },
    data: { status: 'SENDING', nextAt: new Date(now.getTime() + LEASE_MS) },
  })
  if (claimed.count === 0) return { outcome: 'not-due' }

  const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } })
  const attempts = row.attempts + 1
  let error: string
  try {
    const message = JSON.parse(decryptSecret(row.message, messageCtx(id))) as Message
    const result = await sendRendered(message.to, message)
    if (result.sent) {
      await prisma.emailOutbox.updateMany({
        where: { id, status: 'SENDING' },
        data: { status: 'SENT', attempts, sentAt: now, nextAt: null, error: null },
      })
      return { outcome: 'sent' }
    }
    error = result.success ? 'Máy chủ chưa cấu hình gửi email (SMTP)' : `Không gửi được email: ${result.error}`
  } catch (e) {
    error = `Không gửi được email: ${(e as Error).message}`
  }
  const next = attempts < OUTBOX_MAX_ATTEMPTS ? new Date(now.getTime() + BACKOFF_MS[attempts - 1]) : null
  await prisma.emailOutbox.updateMany({
    where: { id, status: 'SENDING' },
    data: { status: 'FAILED', attempts, nextAt: next, error: error.slice(0, 500) },
  })
  console.warn(`[email] ${row.kind} ${id} failed (attempt ${attempts}): ${error}`)
  return { outcome: 'failed', error }
}

/** Sends the email once the response has gone out; outside a request the job sends it. */
export function sendAfterResponse(ids: string[]) {
  try {
    after(async () => {
      for (const id of ids) await sendQueuedEmail(id).catch((e) => console.error('[email] outbox send failed:', e))
    })
  } catch {
    // Not in a request: /api/internal/email-outbox picks them up.
  }
}

/** The scheduled job: everything due, then old sent rows dropped. */
export async function sendDueEmails(now = new Date()) {
  const due = await prisma.emailOutbox.findMany({
    where: { OR: [{ status: 'PENDING' }, { status: { in: ['FAILED', 'SENDING'] }, nextAt: { lte: now } }] },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: { id: true },
  })
  const summary = { sent: 0, failed: 0 }
  for (const { id } of due) {
    const { outcome } = await sendQueuedEmail(id, now)
    if (outcome !== 'not-due') summary[outcome]++
  }
  const { count: pruned } = await prisma.emailOutbox.deleteMany({
    where: { status: 'SENT', sentAt: { lt: new Date(now.getTime() - KEEP_SENT_MS) } },
  })
  return { ...summary, pruned }
}
