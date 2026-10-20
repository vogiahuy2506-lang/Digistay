/**
 * Ops: the schema check behind /api/health, the job history, and the ops
 * alerts (who gets emailed, when, and when not again), against real Postgres.
 * The SMTP send is mocked.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { mkdtemp, mkdir, readdir, rm } from 'fs/promises'
import os from 'os'
import path from 'path'

const sendAlert = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendOpsAlertEmail: sendAlert,
}))

import { prisma } from '@/lib/db'
import { createBooking, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { missingMigrations, redisState } from './health-checks'
import { recordJobRun, pruneJobRuns } from './job-runs'
import { BACKUP_STALE_MS, evaluateAlerts, findProblems } from './alerts'
import { GET as health } from '@/app/api/health/route'
import { POST as opsAlertsRoute } from '@/app/api/internal/ops-alerts/route'

const HOUR = 60 * 60 * 1000
const MIGRATIONS = path.join(process.cwd(), 'prisma', 'migrations')

/** A good daily backup, so only the rule under test fires. */
const backupRow = (startedAt: Date, summary: object = { label: 'daily', uploaded: true }, status = 'SUCCESS') =>
  prisma.jobRun.create({ data: { job: 'backup', status, startedAt, finishedAt: startedAt, summary } })

const keys = async (now = new Date()) => (await findProblems(now)).map((f) => f.key).sort()
const sentKeys = (call = -1) => (sendAlert.mock.calls.at(call)?.[1] as { key: string }[]).map((f) => f.key).sort()

beforeEach(async () => {
  await resetDatabase()
  sendAlert.mockReset()
  sendAlert.mockResolvedValue({ success: true, sent: true })
  vi.stubEnv('ALERT_EMAILS', 'ops@digistay.vn, phuc@digistay.vn')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await prisma.$disconnect()
})

describe('schema check (/api/health)', () => {
  it('passes when every shipped migration is applied, and names the ones that are not', async () => {
    expect(await missingMigrations()).toEqual([])
    expect((await health()).status).toBe(200)

    const dir = await mkdtemp(path.join(os.tmpdir(), 'migrations-'))
    try {
      for (const name of await readdir(MIGRATIONS)) if (!name.endsWith('.toml')) await mkdir(path.join(dir, name))
      await mkdir(path.join(dir, '20991231000000_not_applied_yet'))
      expect(await missingMigrations(dir)).toEqual(['20991231000000_not_applied_yet'])
      expect(await missingMigrations(path.join(dir, 'nowhere'))).toBeNull()
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('an empty database (no _prisma_migrations) lacks all of them', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'migrations-'))
    await mkdir(path.join(dir, '0_init'))
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE _prisma_migrations RENAME TO _prisma_migrations_hidden')
      expect(await missingMigrations(dir)).toEqual(['0_init'])
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE _prisma_migrations_hidden RENAME TO _prisma_migrations')
      await rm(dir, { recursive: true })
    }
  })

  it('reports Redis without failing (none in CI)', async () => {
    expect(await redisState(300)).toBe('down')
    expect(await (await health()).json()).toMatchObject({ status: 'ok', redis: 'down' })
  })
})

describe('job history', () => {
  it('records success with the result, failure with the error, and drops old rows', async () => {
    expect(await recordJobRun('payos-reconcile', async () => ({ checked: 2 }))).toEqual({ checked: 2 })
    await expect(recordJobRun('einvoice-jobs', async () => Promise.reject(new Error('Mắt Bão down')))).rejects.toThrow('Mắt Bão down')
    const runs = await prisma.jobRun.findMany({ orderBy: { startedAt: 'asc' } })
    expect(runs.map((r) => [r.job, r.status, r.summary, r.error])).toEqual([
      ['payos-reconcile', 'SUCCESS', { checked: 2 }, null],
      ['einvoice-jobs', 'FAILURE', null, 'Mắt Bão down'],
    ])
    expect(runs.every((r) => r.finishedAt)).toBe(true)

    await prisma.jobRun.create({ data: { job: 'backup', status: 'SUCCESS', startedAt: new Date(Date.now() - 31 * 24 * HOUR) } })
    expect(await pruneJobRuns()).toBe(1)
    expect(await prisma.jobRun.count()).toBe(2)
  })
})

describe('ops alerts', () => {
  it('a failed job is emailed once to ALERT_EMAILS, reminded after 24 h, and resolved when it runs again', async () => {
    await backupRow(new Date())
    await recordJobRun('einvoice-jobs', async () => Promise.reject(new Error('timeout'))).catch(() => {})
    const t0 = Date.now()

    expect(await evaluateAlerts(new Date(t0))).toMatchObject({ problems: 1, emailed: 1 })
    expect(sendAlert.mock.calls.map(([to]) => to).sort()).toEqual(['ops@digistay.vn', 'phuc@digistay.vn'])
    expect(sentKeys()).toEqual(['job_failed:einvoice-jobs'])
    expect((sendAlert.mock.calls[0][1] as { lines: string[] }[])[0].lines[0]).toContain('timeout')

    sendAlert.mockClear()
    await evaluateAlerts(new Date(t0 + 10 * 60 * 1000))
    await evaluateAlerts(new Date(t0 + 23 * HOUR))
    expect(sendAlert).not.toHaveBeenCalled()
    await evaluateAlerts(new Date(t0 + 24 * HOUR))
    expect(sendAlert).toHaveBeenCalledTimes(2) // the reminder, to both

    await recordJobRun('einvoice-jobs', async () => ({ ok: true }))
    sendAlert.mockClear()
    expect(await evaluateAlerts(new Date(t0 + 25 * HOUR))).toMatchObject({ problems: 0, resolved: 1 })
    expect(sendAlert).not.toHaveBeenCalled()
    expect((await prisma.alertState.findUniqueOrThrow({ where: { key: 'job_failed:einvoice-jobs' } })).resolvedAt).not.toBeNull()

    // It fails again later: a new alert, at once.
    await recordJobRun('einvoice-jobs', async () => Promise.reject(new Error('again'))).catch(() => {})
    await evaluateAlerts(new Date(t0 + 26 * HOUR))
    expect(sendAlert).toHaveBeenCalledTimes(2)
  })

  it('a new item is emailed at once; critical problems are reminded every 6 h', async () => {
    await backupRow(new Date())
    const tenant = await createTenant()
    const stuckInvoice = async () => {
      const booking = await createBooking(tenant.property.id)
      const invoice = await prisma.invoice.create({
        data: {
          bookingId: booking.id,
          propertyId: tenant.property.id,
          invoiceNumber: `INV${Math.random().toString(36).slice(2, 8)}`,
          companyName: '',
          companyAddress: '',
          taxCode: '',
          customerName: 'Khách',
          customerEmail: 'k@example.com',
          subtotal: 1,
          taxAmount: 0,
          totalAmount: 1,
          status: 'PUBLISHING',
        },
      })
      await prisma.$executeRaw`UPDATE invoices SET "updatedAt" = now() - interval '1 hour' WHERE id = ${invoice.id}`
      return invoice
    }
    await stuckInvoice()
    const t0 = Date.now()
    await evaluateAlerts(new Date(t0))
    expect(sentKeys()).toEqual(['einvoice_stuck'])
    const first = (sendAlert.mock.calls[0][1] as { severity: string; lines: string[] }[])[0]
    expect(first.severity).toBe('critical')
    expect(first.lines[0]).toContain(tenant.property.name)

    sendAlert.mockClear()
    await stuckInvoice() // another one: new fingerprint
    await evaluateAlerts(new Date(t0 + 60 * 1000))
    expect(sendAlert).toHaveBeenCalledTimes(2)
    sendAlert.mockClear()
    await evaluateAlerts(new Date(t0 + 5 * HOUR))
    expect(sendAlert).not.toHaveBeenCalled()
    await evaluateAlerts(new Date(t0 + 6 * HOUR + 60 * 1000))
    expect(sendAlert).toHaveBeenCalledTimes(2)
  })

  it('an alert that could not be emailed stays due; without ALERT_EMAILS it goes to SUPER_ADMINs', async () => {
    await backupRow(new Date())
    await recordJobRun('payos-reconcile', async () => Promise.reject(new Error('x'))).catch(() => {})
    sendAlert.mockResolvedValue({ success: true, sent: false, error: 'Email service not configured' })
    expect(await evaluateAlerts()).toMatchObject({ emailed: 0, notEmailed: 1 })
    expect(await evaluateAlerts()).toMatchObject({ emailed: 0, notEmailed: 1 }) // tried again

    vi.stubEnv('ALERT_EMAILS', '')
    const admin = await createUser('boss@digistay.vn')
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'SUPER_ADMIN' } })
    await createUser('someone@example.com')
    sendAlert.mockReset()
    sendAlert.mockResolvedValue({ success: true, sent: true })
    expect(await evaluateAlerts()).toMatchObject({ emailed: 1 })
    expect(sendAlert.mock.calls.map(([to]) => to)).toEqual(['boss@digistay.vn'])
    sendAlert.mockClear()
    await evaluateAlerts()
    expect(sendAlert).not.toHaveBeenCalled()
  })

  it('backups: none, late, failed, kept only on the VPS', async () => {
    const now = new Date()
    expect(await keys(now)).toEqual(['backup_stale'])
    expect((await findProblems(now))[0].title).toContain('Chưa có')

    await backupRow(new Date(now.getTime() - BACKUP_STALE_MS - HOUR))
    expect(await keys(now)).toEqual(['backup_stale'])
    // A pre-deploy backup is local and partial in purpose: it is not the daily one.
    await backupRow(new Date(now.getTime() - 2 * HOUR), { label: 'pre-deploy-abc', uploaded: false })
    expect(await keys(now)).toEqual(['backup_stale'])

    await backupRow(new Date(now.getTime() - HOUR), { label: 'daily', uploaded: false })
    expect(await keys(now)).toEqual(['backup_not_offsite'])

    await backupRow(new Date(now.getTime() - 30 * 60 * 1000), { label: 'daily', uploaded: true })
    await backupRow(new Date(now.getTime() - 60 * 1000), { label: 'pre-deploy-abc', uploaded: false }, 'FAILURE')
    expect(await keys(now)).toEqual(['job_failed:backup'])
    expect((await findProblems(now))[0].severity).toBe('critical')
  })

  it('a job that never finished (process died) counts as failed after an hour', async () => {
    await backupRow(new Date())
    const now = Date.now()
    await prisma.jobRun.create({ data: { job: 'payos-reconcile', status: 'RUNNING', startedAt: new Date(now - 30 * 60 * 1000) } })
    expect(await keys(new Date(now))).toEqual([])
    expect(await keys(new Date(now + 31 * 60 * 1000))).toEqual(['job_failed:payos-reconcile'])
  })

  it('PayOS: wrong amounts, money for closed links, and payments only the reconcile caught', async () => {
    await backupRow(new Date())
    const tenant = await createTenant()
    const log = (action: string, metadata: object) =>
      prisma.activityLog.create({ data: { action, entityType: 'PAYMENT', entityId: 'p', propertyId: tenant.property.id, metadata } })
    await log('PAYOS_PAID', { amount: 100_000, source: 'webhook' }) // normal: nothing
    expect(await keys()).toEqual([])

    await log('PAYOS_AMOUNT_MISMATCH', { expected: 300_000, received: 30_000 })
    await log('PAYOS_PAID', { amount: 200_000, source: 'webhook', paidAfter: 'EXPIRED' })
    await log('PAYOS_PAID', { amount: 150_000, source: 'reconcile' })
    const problems = await findProblems()
    expect(problems.map((f) => f.key).sort()).toEqual(['payos_amount_mismatch', 'payos_missed_webhook', 'payos_paid_late'])
    const mismatch = problems.find((f) => f.key === 'payos_amount_mismatch')!
    expect(mismatch.severity).toBe('critical')
    expect(mismatch.lines[0]).toContain(tenant.property.name)
    expect(mismatch.lines[0]).toContain('30000')
  })

  it('the route needs the cron secret, records its own run and emails', async () => {
    const run = (secret?: string) =>
      opsAlertsRoute(
        new NextRequest('http://digistay.test/api/internal/ops-alerts', {
          method: 'POST',
          headers: secret ? { 'x-cron-secret': secret } : {},
        })
      )
    const secret = `ops-${Math.random().toString(36).slice(2)}-${Date.now()}`
    vi.stubEnv('CRON_SECRET', secret)
    expect((await run()).status).toBe(401)
    const res = await run(secret)
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ problems: 1, emailed: 1, pruned: 0 }) // no backup yet
    expect(await prisma.jobRun.findFirst({ where: { job: 'ops-alerts', status: 'SUCCESS' } })).not.toBeNull()
  })
})
