/**
 * What the system page (/admin/system, SUPER_ADMIN only) shows: health,
 * the scheduled jobs, current problems (the ops alert rules, live), the
 * email queues, and the latest plan e-invoices (src/lib/billing/einvoice.ts)
 * with what can be done about them.
 */
import { prisma, prismaWithDeleted } from '@/lib/db'
import { missingMigrations, redisState } from './health-checks'
import { alertRecipients, findProblems } from './alerts'
import { platformAdmin } from '@/lib/admin/guard'
import { platformPayosConfigured, platformWebhookUrl } from '@/lib/billing/platform-payos'
import os from 'os'
import fs from 'fs'

export const SYSTEM_JOBS = ['payos-reconcile', 'subscription-jobs', 'einvoice-jobs', 'email-outbox', 'purge-deleted', 'ops-alerts', 'backup'] as const
const DAY = 24 * 60 * 60 * 1000

/** Users whose platform role allows the operator pages (src/lib/admin/guard.ts). */
export async function isPlatformAdmin(userId: string) {
  return (await platformAdmin(userId)) !== null
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

  // Hardware & OS metrics
  let disk = { totalGb: 0, usedGb: 0, freeGb: 0, percent: 0 }
  try {
    const s = fs.statfsSync('.')
    const totalGb = Math.round((s.blocks * s.bsize) / (1024 ** 3))
    const freeGb = Math.round((s.bfree * s.bsize) / (1024 ** 3))
    const usedGb = Math.max(0, totalGb - freeGb)
    const percent = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0
    disk = { totalGb, usedGb, freeGb, percent }
  } catch {
    // Non-fatal
  }

  const memory = {
    totalMb: Math.round(os.totalmem() / (1024 * 1024)),
    freeMb: Math.round(os.freemem() / (1024 * 1024)),
    usedMb: Math.round((os.totalmem() - os.freemem()) / (1024 * 1024)),
    percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
  }

  const cpu = {
    cores: os.cpus().length,
    model: os.cpus()[0]?.model || 'Processor',
    loadAvg: os.loadavg(),
  }

  const uptime = Math.round(process.uptime())

  // Database metrics
  let dbMetrics = {
    size: 'N/A',
    activeConnections: 1,
  }
  try {
    const [sizeRow, connRow] = await Promise.all([
      prisma.$queryRaw<{ size: string }[]>`SELECT pg_size_pretty(pg_database_size(current_database())) as size`.catch(() => null),
      prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`.catch(() => null),
    ])
    if (sizeRow && sizeRow[0]?.size) {
      dbMetrics.size = sizeRow[0].size
    }
    if (connRow && connRow[0]?.count != null) {
      dbMetrics.activeConnections = Number(connRow[0].count)
    }
  } catch {
    // Non-fatal
  }

  return {
    checkedAt: now,
    hardware: {
      disk,
      memory,
      cpu,
      uptimeSeconds: uptime,
      nodeVersion: process.version,
    },
    database: dbMetrics,
    health: {
      version: process.env.APP_VERSION || 'dev',
      schema: missing === null ? 'unknown' : missing.length === 0 ? 'ok' : `missing ${missing.length}`,
      redis,
    },
    payos: {
      configured: platformPayosConfigured(),
      webhookUrl: platformWebhookUrl(),
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
