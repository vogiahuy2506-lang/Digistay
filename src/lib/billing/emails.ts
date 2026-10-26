/**
 * Plan emails to the workspace's owner (and the payer, when someone else
 * paid): the receipt of a plan payment and the reminders around the end of
 * a period. Vietnamese, like every email to a hotel's owner
 * (src/lib/email/i18n.ts).
 */
import type { Prisma } from '@prisma/client'
import { prisma, prismaWithDeleted } from '@/lib/db'
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
  // Read outside `db` with the plain client: a deleted workspace (src/lib/deletion,
  // hidden from `prisma`) still gets the receipt of money that reached Digistay.
  const workspace = await prismaWithDeleted.workspace.findUniqueOrThrow({
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

export type ReminderKind = 'soon30' | 'soon7' | 'soon1' | 'ended' | 'locked'

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
    soon30: `[Digistay] ${what} của ${workspace.name} còn 30 ngày`,
    soon7: `[Digistay] ${what} của ${workspace.name} còn 7 ngày`,
    soon1: `[Digistay] ${what} của ${workspace.name} hết hạn ngày mai`,
    ended: `[Digistay] ${what} của ${workspace.name} đã hết hạn`,
    locked: `[Digistay] ${workspace.name} đang bị khoá vì chưa gia hạn`,
  }[kind]
  // Renewing now loses nothing: the new period starts at the end (period.ts planChange).
  const early = sub.trial ? '' : ' Gia hạn ngay bây giờ không mất ngày nào: kỳ mới nối tiếp ngày hết hạn.'
  const lead = {
    soon30: `${what} của workspace ${workspace.name} hết hạn ngày ${end}.${early}`,
    soon7: `${what} của workspace ${workspace.name} hết hạn ngày ${end}.${early}`,
    soon1: `${what} của workspace ${workspace.name} hết hạn ngày ${end}.${early}`,
    ended: `${what} của workspace ${workspace.name} đã hết hạn ngày ${end}. Bạn còn dùng bình thường đến ${lockDay}; sau ngày đó workspace chỉ còn xem và website ngừng nhận đặt phòng online.`,
    locked: `Workspace ${workspace.name} đã chuyển sang chỉ xem vì chưa gia hạn: không tạo hay sửa được dữ liệu, website ngừng nhận đặt phòng online. Dữ liệu vẫn được giữ nguyên.`,
  }[kind]
  const body = message(subject, [lead, '', `Chọn gói và thanh toán bằng mã QR: ${billingUrl(workspace.slug)}`])
  const ids: string[] = []
  for (const user of to) ids.push(await queueEmail('subscription_reminder', { to: { email: user.email, name: user.name ?? undefined }, ...body }, workspaceId, db))
  return ids
}

/** A scheduled downgrade has started (subscription.ts startScheduledPlan); returns the queued ids. */
export async function queueSubscriptionSwitched(
  workspaceId: string,
  change: { plan: string; from: Date; to: Date },
  db: Db = prisma,
): Promise<string[]> {
  const { workspace, to } = await recipients(workspaceId, null, db)
  const plan = planById(change.plan)
  const body = message(`[Digistay] ${workspace.name} đã chuyển sang gói ${capital(plan.id)}`, [
    `Workspace ${workspace.name} đã chuyển sang gói ${capital(plan.id)} như đã hẹn, từ ${vnDate(change.from)} đến ${vnDate(change.to)}.`,
    `Giới hạn mới: ${plan.properties} cơ sở, ${plan.rooms} phòng, ${plan.staff} tài khoản nhân viên, ${plan.invoices} hoá đơn điện tử mỗi tháng.`,
    'Nếu đang dùng nhiều hơn giới hạn mới, bạn có 7 ngày để giảm bớt hoặc nâng gói; sau đó phần vượt sẽ bị khoá (dữ liệu không bị xoá).',
    '',
    `Xem gói: ${billingUrl(workspace.slug)}`,
  ])
  const ids: string[] = []
  for (const user of to) ids.push(await queueEmail('subscription_switched', { to: { email: user.email, name: user.name ?? undefined }, ...body }, workspaceId, db))
  return ids
}

/** The email carrying a plan payment's e-invoice PDF (einvoice.ts sends it, the PDF attached). */
export function subscriptionInvoiceMessage(input: {
  workspace: { name: string; slug: string }
  buyer: string | null
  line: string
  einvoiceNumber: string | null
  series: string | null
  templateCode: string | null
  lookupCode: string
  amount: number
}) {
  const number = input.einvoiceNumber ? ` số ${input.einvoiceNumber}` : ''
  return message(`[Digistay] Hoá đơn điện tử${number} cho ${input.workspace.name}`, [
    input.buyer ? `Kính gửi ${input.buyer},` : 'Kính gửi Quý khách,',
    '',
    `Digistay gửi hoá đơn điện tử cho khoản thanh toán của workspace ${input.workspace.name} (file PDF đính kèm).`,
    `Nội dung: ${input.line}`,
    `Tổng tiền: ${formatVnd(input.amount)}`,
    ...(input.templateCode && input.series ? [`Mẫu số ${input.templateCode} · Ký hiệu ${input.series}${number ? ` ·${number.replace(' số', ' Số')}` : ''}`] : []),
    `Mã tra cứu: ${input.lookupCode}`,
    '',
    `Xem gói và các hoá đơn: ${billingUrl(input.workspace.slug)}`,
  ])
}

function capital(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}
