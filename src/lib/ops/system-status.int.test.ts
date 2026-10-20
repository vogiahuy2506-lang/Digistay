/**
 * The system page's API: SUPER_ADMIN only (checked in the database, others
 * get 404), and what it reports, against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { recordJobRun } from './job-runs'
import { queueEmail } from '@/lib/email/outbox'
import { GET } from '@/app/api/admin/system/route'

const signInAs = (user: { id: string; email: string }, role = 'USER') =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email, role } } as never)

beforeEach(async () => {
  await resetDatabase()
  vi.stubEnv('ALERT_EMAILS', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await prisma.$disconnect()
})

describe('GET /api/admin/system', () => {
  it('is 404 for everyone but a SUPER_ADMIN, whatever the session claims', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    expect((await GET()).status).toBe(401)
    const { owner } = await createTenant()
    signInAs(owner)
    expect((await GET()).status).toBe(404)
    // A stale or forged token role does not count: the database decides.
    signInAs(owner, 'SUPER_ADMIN')
    expect((await GET()).status).toBe(404)
  })

  it('reports health, jobs, problems, queues and recipients', async () => {
    const admin = await createUser('root@digistay.vn')
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'SUPER_ADMIN' } })
    signInAs(admin, 'SUPER_ADMIN')
    await recordJobRun('payos-reconcile', async () => ({ checked: 1 }))
    await recordJobRun('einvoice-jobs', async () => Promise.reject(new Error('Mắt Bão timeout'))).catch(() => {})
    await queueEmail('workspace_invite', { to: { email: 'a@example.com' }, subject: 's', text: 't', html: 'h' })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const data = (await res.json()).data
    expect(data.health).toMatchObject({ schema: 'ok', redis: 'down' })
    const jobs = Object.fromEntries(data.jobs.map((j: { job: string }) => [j.job, j]))
    expect(jobs['payos-reconcile'].last.status).toBe('SUCCESS')
    expect(jobs['einvoice-jobs']).toMatchObject({ last: { status: 'FAILURE', error: 'Mắt Bão timeout' }, failures24h: 1, lastSuccessAt: null })
    expect(jobs.backup.last).toBeNull()
    expect(data.problems.map((p: { key: string }) => p.key).sort()).toEqual(['backup_stale', 'job_failed:einvoice-jobs'])
    expect(data.queues.outbox).toEqual({ PENDING: 1 })
    expect(data.alertRecipients).toEqual(['root@digistay.vn'])
    expect(data.recentRuns).toHaveLength(2)
  })
})
