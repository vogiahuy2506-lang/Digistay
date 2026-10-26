/**
 * What the system page (/admin/system, SUPER_ADMIN only) shows: health,
 * the scheduled jobs, current problems (the ops alert rules, live), the
 * email queues, and the latest plan e-invoices (src/lib/billing/einvoice.ts)
 * with what can be done about them.
 */
import { prisma, prismaWithDeleted } from '@/lib/db'
import { missingMigrations, redisState } from './health-checks'
import { alertRecipients, findProblems } from './alerts'

export const SYSTEM_JOBS = ['payos-reconcile', 'subscription-jobs', 'einvoice-jobs', 'email-outbox', 'purge-deleted', 'ops-alerts', 'backup'] as const
const DAY = 24 * 60 * 60 * 1000

/** Users whose platform role allows the system page (read from the DB, not the token). */
export async function isPlatformAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  return user?.role === 'SUPER_ADMIN'
}

const countBy = (rows: { status: string | null; _count: { _all: number } }[]) =>
  Object.fromEntries(rows.map((r) => [r.status ?? 'NONE', r._count._all]))

export async function systemStatus(now = new Date()) {
  const [missing, redis] = await Promise.all([missingMigrations().catch(() => null), redisState()])

  const jobs = await Promise.all(
    SYSTEM_JOBS.map(async (job) => {
      const [last, lastSuccess, failures24h] = await Promise.all([
        prisma.jobRun.findFirst({ where: { job }, orderBy: { startedAt: 'desc' } }),
        prisma.jobRun.findFirst({ where: { job, status: 'SUCCESS' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }),
        prisma.jobRun.count({ where: { job, status: 'FAILURE', startedAt: { gt: new Date(now.getTime() - DAY) } } }),
      ])
      return {
        job,
        last: last && {
          status: last.status,
          startedAt: last.startedAt,
          durationMs: last.finishedAt ? last.finishedAt.getTime() - last.startedAt.getTime() : null,
          error: last.error,
          summary: last.summary,
        },
        lastSuccessAt: lastSuccess?.startedAt ?? null,
        failures24h,
      }
    })
  )

  const [problems, alerts, recipients, outbox, invoiceEmails, recentRuns, planInvoices] = await Promise.all([
    findProblems(now),
    prisma.alertState.findMany({ orderBy: [{ resolvedAt: { sort: 'desc', nulls: 'first' } }, { firstSeenAt: 'desc' }], take: 30 }),
    alertRecipients(),
    prisma.emailOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.invoice.groupBy({ by: ['emailStatus'], where: { emailStatus: { not: null } }, _count: { _all: true } }),
    prisma.jobRun.findMany({ orderBy: { startedAt: 'desc' }, take: 30 }),
    // With deleted workspaces: their plan invoices still matter.
    prismaWithDeleted.subscriptionInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { payment: { select: { orderCode: true, plan: true, billing: true, workspace: { select: { name: true } } } } },
    }),
  ])

  return {
    checkedAt: now,
    health: {
      version: process.env.APP_VERSION || 'dev',
      schema: missing === null ? 'unknown' : missing.length === 0 ? 'ok' : `missing ${missing.length}`,
      redis,
    },
    problems,
    alerts,
    alertRecipients: recipients,
    jobs,
    queues: {
      outbox: countBy(outbox),
      invoiceEmails: countBy(invoiceEmails.map((r) => ({ status: r.emailStatus, _count: r._count }))),
    },
    planInvoices: planInvoices.map((i) => ({
      id: i.id,
      workspace: i.payment.workspace.name,
      orderCode: i.payment.orderCode,
      plan: i.payment.plan,
      billing: i.payment.billing,
      amount: i.amount,
      buyerType: i.buyerType,
      buyer: i.companyName ?? i.buyerName,
      status: i.status,
      environment: i.environment,
      einvoiceNumber: i.einvoiceNumber,
      attempts: i.attempts,
      nextAttemptAt: i.nextAttemptAt,
      error: i.error,
      emailStatus: i.emailStatus,
      emailError: i.emailError,
      cqtStatus: i.cqtStatus,
      createdAt: i.createdAt,
    })),
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      job: r.job,
      status: r.status,
      startedAt: r.startedAt,
      durationMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null,
      error: r.error,
    })),
  }
}

export type SystemStatus = Awaited<ReturnType<typeof systemStatus>>
