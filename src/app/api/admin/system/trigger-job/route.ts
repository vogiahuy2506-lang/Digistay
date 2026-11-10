import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db'
import { recordJobRun } from '@/lib/ops/job-runs'
import { runSubscriptionReminders } from '@/lib/billing/jobs'
import { runSubscriptionInvoiceJobs } from '@/lib/billing/einvoice'
import { runOverageJobs } from '@/lib/billing/overage'
import { runUsageAlerts } from '@/lib/billing/usage-alerts'
import { sendDueEmails } from '@/lib/email/outbox'
import { evaluateAlerts } from '@/lib/ops/alerts'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const JobSchema = z.object({
  job: z.enum([
    'subscription-jobs',
    'einvoice-jobs',
    'email-outbox',
    'ops-alerts',
    'payos-reconcile',
    'purge-deleted',
    'abandoned-cart',
    'post-stay-survey',
  ]),
})

export async function POST(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = JobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Mã tiến trình không hợp lệ' }, { status: 400 })
  }

  const { job } = parsed.data

  try {
    let result: any = null

    if (job === 'subscription-jobs') {
      result = await recordJobRun('subscription-jobs', async () => ({
        reminders: await runSubscriptionReminders(),
        invoices: await runSubscriptionInvoiceJobs(),
        overage: await runOverageJobs(),
        usage: await runUsageAlerts(),
      }))
    } else if (job === 'einvoice-jobs') {
      result = await recordJobRun('einvoice-jobs', async () => ({
        invoices: await runSubscriptionInvoiceJobs(),
      }))
    } else if (job === 'email-outbox') {
      result = await recordJobRun('email-outbox', () => sendDueEmails())
    } else if (job === 'ops-alerts') {
      result = await recordJobRun('ops-alerts', async () => evaluateAlerts())
    } else {
      // Generic recorded run
      result = await recordJobRun(job, async () => ({
        triggeredBy: check.admin.email,
        timestamp: new Date().toISOString(),
      }))
    }

    // Log admin activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: check.admin.id,
          action: 'TRIGGER_CRON_JOB',
          entityType: 'JOB_RUN',
          entityId: job,
          metadata: { job, result },
        },
      })
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Lỗi khi kích hoạt tiến trình' },
      { status: 500 }
    )
  }
}
