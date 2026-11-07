import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { setUserPlan, AdminActionError } from '@/lib/admin/users'
import { PLAN_IDS } from '@/lib/marketing/plans'

const body = z.object({
  plan: z.enum(PLAN_IDS),
  trial: z.boolean(),
  /** The last day of the period (Vietnam time): it ends at the day's end. */
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hết hạn không hợp lệ'),
  note: z.string().trim().min(3, 'Ghi rõ lý do (ít nhất 3 ký tự)').max(500),
})

/** 23:59:59.999 of `day` in Vietnam (UTC+7). */
const endOfVietnamDay = (day: string) => new Date(Date.parse(`${day}T23:59:59.999+07:00`))

/**
 * POST /api/admin/users/[userId]/plan { plan, trial, periodEnd, note }
 * — sets the user's plan by hand, propagating to all workspaces they own.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const { userId } = await props.params
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  try {
    const plan = await setUserPlan(granted.admin, userId, { ...parsed.data, periodEnd: endOfVietnamDay(parsed.data.periodEnd) })
    return NextResponse.json({ success: true, data: plan })
  } catch (error) {
    if (error instanceof AdminActionError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    throw error
  }
}

