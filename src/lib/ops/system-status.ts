/**
 * What the system page (/admin/system, SUPER_ADMIN only) shows: health,
 * the scheduled jobs, current problems (the ops alert rules, live), and the
 * email queues.
 */
import { prisma } from '@/lib/db'
import { missingMigrations, redisState } from './health-checks'
import { alertRecipients, findProblems } from './alerts'

export const SYSTEM_JOBS = ['payos-reconcile', 'einvoice-jobs', 'email-outbox', 'ops-alerts', 'backup'] as const
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

  const [problems, alerts, recipients, outbox, invoiceEmails, recentRuns] = await Promise.all([
    findProblems(now),
    prisma.alertState.findMany({ orderBy: [{ resolvedAt: { sort: 'desc', nulls: 'first' } }, { firstSeenAt: 'desc' }], take: 30 }),
    alertRecipients(),
    prisma.emailOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.invoice.groupBy({ by: ['emailStatus'], where: { emailStatus: { not: null } }, _count: { _all: true } }),
    prisma.jobRun.findMany({ orderBy: { startedAt: 'desc' }, take: 30 }),
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
