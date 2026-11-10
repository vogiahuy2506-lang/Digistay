import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/admin/guard', () => ({
  requirePlatformAdmin: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/ops/job-runs', () => ({
  recordJobRun: vi.fn((name: string, fn: () => any) => fn()),
}))

vi.mock('@/lib/billing/jobs', () => ({
  runSubscriptionReminders: vi.fn().mockResolvedValue({ count: 0 }),
}))

vi.mock('@/lib/billing/einvoice', () => ({
  runSubscriptionInvoiceJobs: vi.fn().mockResolvedValue({ count: 0 }),
}))

vi.mock('@/lib/billing/overage', () => ({
  runOverageJobs: vi.fn().mockResolvedValue({ count: 0 }),
}))

vi.mock('@/lib/billing/usage-alerts', () => ({
  runUsageAlerts: vi.fn().mockResolvedValue({ count: 0 }),
}))

vi.mock('@/lib/email/outbox', () => ({
  sendDueEmails: vi.fn().mockResolvedValue({ sent: 5 }),
}))

vi.mock('@/lib/ops/alerts', () => ({
  evaluateAlerts: vi.fn().mockResolvedValue({ ok: true }),
}))

import { requirePlatformAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db'
import { POST as triggerJob } from './route'

describe('POST /api/admin/system/trigger-job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      ok: true,
      admin: { id: 'admin-1', email: 'admin@digistay.vn', role: 'SUPER_ADMIN' } as any,
    })
  })

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    })

    const req = new NextRequest('http://localhost/api/admin/system/trigger-job', {
      method: 'POST',
      body: JSON.stringify({ job: 'email-outbox' }),
    })

    const res = await triggerJob(req)
    expect(res.status).toBe(401)
  })

  it('rejects invalid job name', async () => {
    const req = new NextRequest('http://localhost/api/admin/system/trigger-job', {
      method: 'POST',
      body: JSON.stringify({ job: 'invalid-job-name' }),
    })

    const res = await triggerJob(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Mã tiến trình không hợp lệ')
  })

  it('successfully triggers email-outbox and logs activity', async () => {
    const req = new NextRequest('http://localhost/api/admin/system/trigger-job', {
      method: 'POST',
      body: JSON.stringify({ job: 'email-outbox' }),
    })

    const res = await triggerJob(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'TRIGGER_CRON_JOB',
          entityType: 'JOB_RUN',
          entityId: 'email-outbox',
        }),
      })
    )
  })

  it('successfully triggers subscription-jobs', async () => {
    const req = new NextRequest('http://localhost/api/admin/system/trigger-job', {
      method: 'POST',
      body: JSON.stringify({ job: 'subscription-jobs' }),
    })

    const res = await triggerJob(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})

