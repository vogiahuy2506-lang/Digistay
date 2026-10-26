/**
 * The owner's emails about using more than the plan allows
 * (src/lib/billing/overage.ts): once when the 7-day grace starts, and what
 * was locked when it ended. Vietnamese, like every email to a hotel's owner.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { queueEmail } from '@/lib/email/outbox'
import { planById } from '@/lib/marketing/plans'
import { appOrigin } from '@/lib/public-site/site-host'
import { escapeHtml } from '@/lib/utils/escape-html'
import type { OverageKind } from './overage-plan'

type Db = Prisma.TransactionClient | typeof prisma

/** 26/10/2026, Vietnam time. */
const vnDate = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)

const billingUrl = (slug: string) => `${appOrigin()}/workspace/${slug}/billing`
const planName = (id: string) => {
  const plan = planById(id).id
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

const KIND_UNITS: Record<OverageKind, string> = { properties: 'cơ sở', rooms: 'phòng', staff: 'tài khoản nhân viên' }

async function owner(workspaceId: string, db: Db) {
  return db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true, slug: true, owner: { select: { email: true, name: true } } },
  })
}

function message(subject: string, lines: string[]) {
  const text = lines.join('\n')
  return { subject, text, html: escapeHtml(text).replace(/\n/g, '<br/>') }
}

/** "3/1 cơ sở, 40/15 phòng": used over the limit, per kind over. */
export function overText(over: Partial<Record<OverageKind, { used: number; limit: number }>>): string {
  return (Object.keys(KIND_UNITS) as OverageKind[])
    .filter((kind) => over[kind])
    .map((kind) => `${over[kind]!.used}/${over[kind]!.limit} ${KIND_UNITS[kind]}`)
    .join(', ')
}

/** The grace started: what is over and when the excess locks. Returns the queued id. */
export async function queueOverageGrace(
  workspaceId: string,
  input: { plan: string; over: Partial<Record<OverageKind, { used: number; limit: number }>>; locksAt: Date },
  db: Db = prisma,
): Promise<string> {
  const ws = await owner(workspaceId, db)
  const body = message(`[Digistay] ${ws.name} đang dùng vượt giới hạn gói ${planName(input.plan)}`, [
    `Workspace ${ws.name} đang dùng vượt giới hạn gói ${planName(input.plan)}: ${overText(input.over)}.`,
    '',
    `Từ ngày ${vnDate(input.locksAt)}, phần vượt sẽ bị khoá, mới nhất trước: cơ sở chuyển sang chỉ xem và ngừng nhận đặt phòng online, hạng phòng ngừng nhận đơn mới, tài khoản nhân viên không vào được workspace (lời mời chưa nhận bị huỷ trước). Dữ liệu không bị xoá.`,
    '',
    `Để không bị khoá, hãy giảm bớt cho vừa gói (xoá hoặc ngừng dùng cơ sở, hạng phòng, tài khoản nhân viên) hoặc nâng cấp gói: ${billingUrl(ws.slug)}`,
  ])
  return queueEmail('plan_overage_grace', { to: { email: ws.owner.email, name: ws.owner.name ?? undefined }, ...body }, workspaceId, db)
}

export interface LockedForEmail {
  properties: { name: string }[]
  roomTypes: { name: string; propertyName: string; rooms: number }[]
  members: { name: string | null; email: string }[]
  invitations: { email: string }[]
}

/** The grace ended: what was locked (and the invitations revoked). Returns the queued id. */
export async function queueOverageLocked(workspaceId: string, input: { plan: string; locked: LockedForEmail }, db: Db = prisma): Promise<string> {
  const ws = await owner(workspaceId, db)
  const { locked } = input
  const lines = [
    `Workspace ${ws.name} đã dùng vượt giới hạn gói ${planName(input.plan)} quá 7 ngày nên phần vượt đã bị khoá. Dữ liệu vẫn được giữ nguyên.`,
    '',
  ]
  if (locked.properties.length) {
    lines.push(`Cơ sở chuyển sang chỉ xem, ngừng nhận đặt phòng online: ${locked.properties.map((p) => p.name).join(', ')}.`)
  }
  if (locked.roomTypes.length) {
    lines.push(
      `Hạng phòng ngừng nhận đơn mới (đơn đã có vẫn xử lý bình thường): ${locked.roomTypes.map((rt) => `${rt.name} – ${rt.propertyName}, ${rt.rooms} phòng`).join('; ')}.`,
    )
  }
  if (locked.members.length) {
    lines.push(`Tài khoản nhân viên không vào được workspace: ${locked.members.map((m) => (m.name ? `${m.name} (${m.email})` : m.email)).join(', ')}.`)
  }
  if (locked.invitations.length) {
    lines.push(`Lời mời chưa nhận đã bị huỷ: ${locked.invitations.map((i) => i.email).join(', ')}.`)
  }
  lines.push('', `Phần bị khoá tự mở lại khi gói còn chỗ: nâng cấp gói hoặc giảm bớt cho vừa gói tại ${billingUrl(ws.slug)}`)
  const body = message(`[Digistay] Đã khoá phần dùng vượt gói của ${ws.name}`, lines)
  return queueEmail('plan_overage_locked', { to: { email: ws.owner.email, name: ws.owner.name ?? undefined }, ...body }, workspaceId, db)
}
