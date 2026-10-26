/**
 * Plan emails to the workspace's owner (and the payer, when someone else
 * paid): the receipt of a plan payment and the reminders around the end of
 * a period. Vietnamese, like every email to a hotel's owner
 * (src/lib/email/i18n.ts).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { queueEmail } from '@/lib/email/outbox'
import { formatVnd } from '@/lib/bookings/display'
import { planById } from '@/lib/marketing/plans'
import { appOrigin } from '@/lib/public-site/site-host'
import { escapeHtml } from '@/lib/utils/escape-html'
import { GRACE_DAYS } from './period'

type Db = Prisma.TransactionClient | typeof prisma

/** 26/10/2026, Vietnam time. */
export function vnDate(d: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

const billingUrl = (slug: string) => `${appOrigin()}/workspace/${slug}/billing`

async function recipients(workspaceId: string, extraUserId: string | null, db: Db) {
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true, slug: true, owner: { select: { id: true, email: true, name: true } } },
  })
  const to = [workspace.owner]
  if (extraUserId && extraUserId !== workspace.owner.id) {
    const payer = await db.user.findUnique({ where: { id: extraUserId }, select: { id: true, email: true, name: true } })
    if (payer) to.push(payer)
  }
  return { workspace, to }
}

function message(subject: string, lines: string[]) {
  const text = lines.join('\n')
  return { subject, text, html: escapeHtml(text).replace(/\n/g, '<br/>') }
}

/** The receipt of a paid plan payment; returns the queued ids. */
export async function queueSubscriptionPaid(paymentId: string, db: Db = prisma): Promise<string[]> {
  const payment = await db.subscriptionPayment.findUniqueOrThrow({ where: { id: paymentId } })
  const { workspace, to } = await recipients(payment.workspaceId, payment.createdById, db)
  const plan = planById(payment.plan)
  const body = message(`[Digistay] Đã nhận thanh toán gói ${capital(plan.id)} cho ${workspace.name}`, [
    `Digistay đã nhận ${formatVnd(payment.amount)} cho gói ${capital(plan.id)} (${payment.billing === 'YEAR' ? 'theo năm' : 'theo tháng'}) của workspace ${workspace.name}.`,
    `Gói có hiệu lực từ ${vnDate(payment.periodStart ?? new Date())} đến ${vnDate(payment.periodEnd ?? new Date())}.`,
    `Mã giao dịch: ${payment.orderCode}${payment.reference ? ` · Tham chiếu ngân hàng: ${payment.reference}` : ''}`,
    `Giới hạn: ${plan.properties} cơ sở, ${plan.rooms} phòng, ${plan.staff} tài khoản nhân viên, ${plan.invoices} hoá đơn điện tử mỗi tháng.`,
    '',
    `Xem gói và lịch sử thanh toán: ${billingUrl(workspace.slug)}`,
  ])
  const ids: string[] = []
  for (const user of to) ids.push(await queueEmail('subscription_paid', { to: { email: user.email, name: user.name ?? undefined }, ...body }, payment.id, db))
  return ids
}

export type ReminderKind = 'soon7' | 'soon1' | 'ended' | 'locked'

/** One reminder around the end of the period; returns the queued ids. */
export async function queueSubscriptionReminder(
  workspaceId: string,
  kind: ReminderKind,
  sub: { trial: boolean; plan: string; periodEnd: Date },
  db: Db = prisma,
): Promise<string[]> {
  const { workspace, to } = await recipients(workspaceId, null, db)
  const what = sub.trial ? 'Thời gian dùng thử' : `Gói ${capital(planById(sub.plan).id)}`
  const end = vnDate(sub.periodEnd)
  const lockDay = vnDate(new Date(sub.periodEnd.getTime() + GRACE_DAYS * 86_400_000))
  const subject = {
    soon7: `[Digistay] ${what} của ${workspace.name} còn 7 ngày`,
    soon1: `[Digistay] ${what} của ${workspace.name} hết hạn ngày mai`,
    ended: `[Digistay] ${what} của ${workspace.name} đã hết hạn`,
    locked: `[Digistay] ${workspace.name} đang bị khoá vì chưa gia hạn`,
  }[kind]
  const lead = {
    soon7: `${what} của workspace ${workspace.name} hết hạn ngày ${end}.`,
    soon1: `${what} của workspace ${workspace.name} hết hạn ngày ${end}.`,
    ended: `${what} của workspace ${workspace.name} đã hết hạn ngày ${end}. Bạn còn dùng bình thường đến ${lockDay}; sau ngày đó workspace chỉ còn xem và website ngừng nhận đặt phòng online.`,
    locked: `Workspace ${workspace.name} đã chuyển sang chỉ xem vì chưa gia hạn: không tạo hay sửa được dữ liệu, website ngừng nhận đặt phòng online. Dữ liệu vẫn được giữ nguyên.`,
  }[kind]
  const body = message(subject, [lead, '', `Chọn gói và thanh toán bằng mã QR: ${billingUrl(workspace.slug)}`])
  const ids: string[] = []
  for (const user of to) ids.push(await queueEmail('subscription_reminder', { to: { email: user.email, name: user.name ?? undefined }, ...body }, workspaceId, db))
  return ids
}

function capital(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}
