/**
 * Ops alerts for the people running Digistay, by email (Founder AI's
 * alertEvaluator, smaller). Every 10 minutes the scheduled jobs call
 * /api/internal/ops-alerts, which checks the rules below.
 *
 * - A problem is emailed once, then as a reminder every REPEAT_MS of its
 *   severity while it lasts. A new item (another stuck invoice, another
 *   failed run) changes the fingerprint and is emailed at once.
 * - When a rule finds nothing, its alert is marked resolved (no email).
 * - Recipients: ALERT_EMAILS (comma separated), otherwise every SUPER_ADMIN.
 *   An alert that could not be emailed (no SMTP, no recipients) stays due,
 *   so it goes out once email works.
 *
 * The blind spot, as at Founder AI: if the app or the timer is down, nothing
 * here runs. An outside uptime check of /api/health covers the app.
 */
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { sendOpsAlertEmail } from '@/lib/email'

export type Severity = 'critical' | 'warning'

export interface Finding {
  key: string
  severity: Severity
  title: string
  /** what to look at, one line per item (at most MAX_LINES are shown) */
  lines: string[]
  /** identifies the items: changes when a new one appears */
  fingerprint: string
}

const HOUR = 60 * 60 * 1000
const REPEAT_MS: Record<Severity, number> = { critical: 6 * HOUR, warning: 24 * HOUR }
const MAX_LINES = 10
/** The jobs whose failures are alerted; ops-alerts itself is not (it would be the one telling). */
export const WATCHED_JOBS = ['payos-reconcile', 'subscription-jobs', 'einvoice-jobs', 'email-outbox', 'backup'] as const
/** A RUNNING row this old means the process died mid-run. */
const STUCK_RUN_MS = HOUR
/** The daily backup timer runs once a day; a day and a bit without a good one is late. */
export const BACKUP_STALE_MS = 30 * HOUR

const fingerprintOf = (ids: string[]) => createHash('sha256').update([...ids].sort().join(',')).digest('hex').slice(0, 32)
const vnTime = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(d)

async function propertyNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const rows = await prisma.property.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } })
  const map = new Map(rows.map((r) => [r.id, r.name]))
  return (id: string | null) => (id && map.get(id)) || 'khách sạn không rõ'
}

async function jobFailures(now: Date): Promise<Finding[]> {
  const findings: Finding[] = []
  for (const job of WATCHED_JOBS) {
    const last = await prisma.jobRun.findFirst({ where: { job }, orderBy: { startedAt: 'desc' } })
    if (!last) continue
    const died = last.status === 'RUNNING' && now.getTime() - last.startedAt.getTime() > STUCK_RUN_MS
    if (last.status !== 'FAILURE' && !died) continue
    findings.push({
      key: `job_failed:${job}`,
      severity: job === 'backup' ? 'critical' : 'warning',
      title: `Job "${job}" ${died ? 'chạy dở rồi dừng' : 'bị lỗi'}`,
      lines: [`Lần chạy lúc ${vnTime(last.startedAt)}: ${died ? 'không kết thúc sau 1 giờ' : last.error ?? 'không rõ lỗi'}`],
      fingerprint: last.id,
    })
  }
  return findings
}

async function backupStale(now: Date): Promise<Finding[]> {
  const last = await prisma.jobRun.findFirst({
    where: { job: 'backup', status: 'SUCCESS', summary: { path: ['label'], equals: 'daily' } },
    orderBy: { startedAt: 'desc' },
  })
  if (last && now.getTime() - last.startedAt.getTime() <= BACKUP_STALE_MS) {
    const uploaded = (last.summary as Record<string, unknown> | null)?.uploaded
    if (uploaded !== false) return []
    return [
      {
        key: 'backup_not_offsite',
        severity: 'warning',
        title: 'Backup hằng ngày chỉ nằm trên VPS (chưa chép lên GCS)',
        lines: ['Đặt BACKUP_GCS_BUCKET trong /etc/digistay/backup.env (RUNBOOK, "Backup & khôi phục")'],
        fingerprint: 'local-only',
      },
    ]
  }
  return [
    {
      key: 'backup_stale',
      severity: 'critical',
      title: last ? 'Backup database hằng ngày đã quá 30 giờ' : 'Chưa có bản backup database hằng ngày nào',
      lines: [
        last
          ? `Bản thành công gần nhất: ${vnTime(last.startedAt)}`
          : 'Timer digistay-backup chưa chạy lần nào (RUNBOOK, "Backup & khôi phục")',
      ],
      fingerprint: last?.id ?? 'none',
    },
  ]
}

async function einvoiceStuck(now: Date): Promise<Finding[]> {
  const stuck = await prisma.invoice.findMany({
    where: {
      OR: [
        // A publish that never came back (the lease is 2 minutes).
        { status: 'PUBLISHING', updatedAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) } },
        // An uncertain publish nobody settled: edits stay locked meanwhile.
        { status: 'PENDING', lookupCode: { not: null }, updatedAt: { lt: new Date(now.getTime() - HOUR) } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: 50,
    select: { id: true, invoiceNumber: true, status: true, updatedAt: true, property: { select: { name: true } } },
  })
  if (stuck.length === 0) return []
  return [
    {
      key: 'einvoice_stuck',
      severity: 'critical',
      title: `${stuck.length} hoá đơn điện tử phát hành chưa rõ kết quả`,
      lines: stuck.map(
        (i) => `${i.property.name} · ${i.invoiceNumber} · ${i.status === 'PUBLISHING' ? 'đang phát hành' : 'chờ phát hành lại'} từ ${vnTime(i.updatedAt)}`
      ),
      fingerprint: fingerprintOf(stuck.map((i) => i.id)),
    },
  ]
}

async function einvoiceEmailGaveUp(now: Date): Promise<Finding[]> {
  const failed = await prisma.invoice.findMany({
    where: { emailStatus: 'FAILED', emailNextAt: null, updatedAt: { gt: new Date(now.getTime() - 7 * 24 * HOUR) } },
    take: 50,
    select: { id: true, einvoiceNumber: true, invoiceNumber: true, emailError: true, property: { select: { name: true } } },
  })
  if (failed.length === 0) return []
  return [
    {
      key: 'einvoice_email_gave_up',
      severity: 'warning',
      title: `${failed.length} email hoá đơn đã thử hết số lần mà không gửi được`,
      lines: failed.map((i) => `${i.property.name} · số ${i.einvoiceNumber ?? i.invoiceNumber} · ${i.emailError ?? ''}`),
      fingerprint: fingerprintOf(failed.map((i) => i.id)),
    },
  ]
}

async function outboxGaveUp(now: Date): Promise<Finding[]> {
  const failed = await prisma.emailOutbox.findMany({
    where: { status: 'FAILED', nextAt: null, updatedAt: { gt: new Date(now.getTime() - 7 * 24 * HOUR) } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, kind: true, toEmail: true, error: true },
  })
  if (failed.length === 0) return []
  const kinds: Record<string, string> = {
    booking_confirmation: 'xác nhận đặt phòng',
    owner_new_booking: 'báo đơn mới cho chủ',
    workspace_invite: 'lời mời',
    deposit_received: 'báo đã nhận cọc',
    deposit_expired: 'báo huỷ vì chưa cọc',
  }
  return [
    {
      key: 'email_gave_up',
      severity: 'warning',
      title: `${failed.length} email (đặt phòng, lời mời) đã thử hết số lần mà không gửi được`,
      lines: failed.map((e) => `${kinds[e.kind] ?? e.kind} · ${e.toEmail} · ${e.error ?? ''}`),
      fingerprint: fingerprintOf(failed.map((e) => e.id)),
    },
  ]
}

async function payosFlags(now: Date): Promise<Finding[]> {
  const since = (hours: number) => ({ gt: new Date(now.getTime() - hours * HOUR) })
  const meta = (l: { metadata: unknown }) => (l.metadata ?? {}) as Record<string, unknown>
  const [mismatch, paid] = await Promise.all([
    prisma.activityLog.findMany({ where: { action: 'PAYOS_AMOUNT_MISMATCH', createdAt: since(48) }, take: 50 }),
    prisma.activityLog.findMany({ where: { action: 'PAYOS_PAID', createdAt: since(48) }, orderBy: { createdAt: 'desc' }, take: 500 }),
  ])
  // Money for a link that was cancelled/expired, or for a booking already closed.
  const late = paid.filter((l) => meta(l).paidAfter || meta(l).paidAfterClosed)
  const dayAgo = now.getTime() - 24 * HOUR
  const missed = paid.filter((l) => meta(l).source === 'reconcile' && l.createdAt.getTime() > dayAgo)
  const nameOf = await propertyNames([...mismatch, ...late, ...missed].map((l) => l.propertyId))
  const findings: Finding[] = []
  if (mismatch.length > 0) {
    findings.push({
      key: 'payos_amount_mismatch',
      severity: 'critical',
      title: `${mismatch.length} khoản PayOS về sai số tiền (không được ghi nhận)`,
      lines: mismatch.map((l) => `${nameOf(l.propertyId)} · cần ${meta(l).expected} ₫, nhận ${meta(l).received} ₫ · ${vnTime(l.createdAt)}`),
      fingerprint: fingerprintOf(mismatch.map((l) => l.id)),
    })
  }
  if (late.length > 0) {
    findings.push({
      key: 'payos_paid_late',
      severity: 'warning',
      title: `${late.length} khoản PayOS trả vào link đã huỷ/hết hạn (đã ghi nhận, cần nhân viên kiểm)`,
      lines: late.map(
        (l) =>
          `${nameOf(l.propertyId)} · ${meta(l).amount ?? '?'} ₫ · ${meta(l).paidAfter ? `link ${meta(l).paidAfter}` : 'đơn đã đóng'} · ${vnTime(l.createdAt)}`
      ),
      fingerprint: fingerprintOf(late.map((l) => l.id)),
    })
  }
  if (missed.length > 0) {
    findings.push({
      key: 'payos_missed_webhook',
      severity: 'warning',
      title: `${missed.length} khoản PayOS chỉ được ghi nhận nhờ đối soát (webhook không tới)`,
      lines: missed.map((l) => `${nameOf(l.propertyId)} · ${vnTime(l.createdAt)}: kiểm URL webhook PayOS của khách sạn này`),
      fingerprint: fingerprintOf(missed.map((l) => l.id)),
    })
  }
  return findings
}

export async function findProblems(now = new Date()): Promise<Finding[]> {
  const groups = await Promise.all([jobFailures(now), backupStale(now), einvoiceStuck(now), einvoiceEmailGaveUp(now), outboxGaveUp(now), payosFlags(now)])
  return groups.flat().map((f) => ({ ...f, lines: f.lines.slice(0, MAX_LINES).concat(f.lines.length > MAX_LINES ? [`… và ${f.lines.length - MAX_LINES} mục khác`] : []) }))
}

export async function alertRecipients(): Promise<string[]> {
  const configured = (process.env.ALERT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.includes('@'))
  if (configured.length > 0) return configured
  const admins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { email: true } })
  return admins.map((a) => a.email).filter((e): e is string => Boolean(e))
}

/** Checks the rules, emails what is due, and records what was seen. */
export async function evaluateAlerts(now = new Date()) {
  const findings = await findProblems(now)
  const states = new Map((await prisma.alertState.findMany()).map((s) => [s.key, s]))

  const due = findings.filter((f) => {
    const state = states.get(f.key)
    if (!state || state.resolvedAt || !state.lastSentAt || state.fingerprint !== f.fingerprint) return true
    return now.getTime() - state.lastSentAt.getTime() >= REPEAT_MS[f.severity]
  })

  let emailed = false
  let notEmailed: string | null = null
  if (due.length > 0) {
    const to = await alertRecipients()
    if (to.length === 0) notEmailed = 'no recipients (ALERT_EMAILS or a SUPER_ADMIN user)'
    else {
      const results = await Promise.all(to.map((email) => sendOpsAlertEmail(email, due)))
      emailed = results.some((r) => r.sent)
      if (!emailed) notEmailed = results[0]?.error ?? 'email not sent'
    }
    if (notEmailed) console.warn(`[ops] ${due.length} alert(s) not emailed (${notEmailed}): ${due.map((f) => f.key).join(', ')}`)
  }

  // fingerprint/lastSentAt record what was EMAILED: an alert that could not
  // be sent keeps differing, so it is due again on the next run.
  for (const f of findings) {
    const sentNow = emailed && due.includes(f)
    const previous = states.get(f.key)
    const reopened = !previous || Boolean(previous.resolvedAt)
    await prisma.alertState.upsert({
      where: { key: f.key },
      create: {
        key: f.key,
        severity: f.severity,
        title: f.title,
        firstSeenAt: now,
        fingerprint: sentNow ? f.fingerprint : '',
        ...(sentNow && { lastSentAt: now }),
      },
      update: {
        severity: f.severity,
        title: f.title,
        resolvedAt: null,
        ...(reopened && { firstSeenAt: now, lastSentAt: null, fingerprint: '' }),
        ...(sentNow && { fingerprint: f.fingerprint, lastSentAt: now }),
      },
    })
  }
  const active = new Set(findings.map((f) => f.key))
  const resolved = [...states.values()].filter((s) => !s.resolvedAt && !active.has(s.key)).map((s) => s.key)
  if (resolved.length > 0) {
    await prisma.alertState.updateMany({ where: { key: { in: resolved } }, data: { resolvedAt: now } })
  }

  return { problems: findings.length, emailed: emailed ? due.length : 0, notEmailed: notEmailed ? due.length : 0, resolved: resolved.length }
}
