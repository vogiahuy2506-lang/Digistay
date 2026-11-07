import { describe, it, expect, vi } from 'vitest'
import type { UserRole } from '@prisma/client'
import { userView } from './users'
import { inheritedOrTrialFields, trialFields } from '@/lib/billing/subscription'

describe('userView plan extraction', () => {
  const baseUser = {
    id: 'user_1',
    name: 'Nguyễn Văn A',
    email: 'a@digistay.vn',
    username: 'nguyenvana',
    phone: '0901234567',
    role: 'USER' as UserRole,
    emailVerified: new Date(),
    disabledAt: null,
    disabledReason: null,
    createdAt: new Date(),
    twoFactor: null,
    _count: { ownedWorkspaces: 2, workspaceMembers: 2 },
  }

  it('returns null plan when user has no owned workspaces', () => {
    const view = userView({ ...baseUser, ownedWorkspaces: [] })
    expect(view.plan).toBeNull()
  })

  it('extracts and sorts plan to find the best active subscription', () => {
    const now = new Date()
    const trialSub = {
      workspaceId: 'ws_1',
      plan: 'starter',
      billing: null,
      trial: true,
      periodStart: now,
      periodEnd: new Date(now.getTime() + 7 * 86_400_000),
      reminders: null,
      nextPlan: null,
      nextBilling: null,
      nextPeriodEnd: null,
      nextPaymentId: null,
      overLimitSince: null,
      usageAlerts: null,
      trialWelcomedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    const paidSub = {
      workspaceId: 'ws_2',
      plan: 'growth',
      billing: 'MONTH' as const,
      trial: false,
      periodStart: now,
      periodEnd: new Date(now.getTime() + 30 * 86_400_000),
      reminders: null,
      nextPlan: null,
      nextBilling: null,
      nextPeriodEnd: null,
      nextPaymentId: null,
      overLimitSince: null,
      usageAlerts: null,
      trialWelcomedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const view = userView(
      {
        ...baseUser,
        ownedWorkspaces: [
          { id: 'ws_1', subscription: trialSub },
          { id: 'ws_2', subscription: paidSub },
        ],
      },
      now
    )

    expect(view.plan).not.toBeNull()
    expect(view.plan?.plan).toBe('growth')
    expect(view.plan?.trial).toBe(false)
  })
})

describe('inheritedOrTrialFields', () => {
  it('falls back to trialFields when db finds no active subscription', async () => {
    const mockDb: any = {
      subscription: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    }

    const now = new Date()
    const res = await inheritedOrTrialFields('user_1', mockDb, now)
    expect(res).toEqual({ ...trialFields(now), billing: null })
    expect(res.trial).toBe(true)
  })

  it('inherits active subscription when found', async () => {
    const now = new Date()
    const futureEnd = new Date(now.getTime() + 180 * 86_400_000)
    const mockDb: any = {
      subscription: {
        findFirst: vi.fn().mockResolvedValue({
          plan: 'business',
          trial: false,
          billing: 'YEAR',
          periodEnd: futureEnd,
        }),
      },
    }

    const res = await inheritedOrTrialFields('user_1', mockDb, now)
    expect(res.plan).toBe('business')
    expect(res.trial).toBe(false)
    expect(res.billing).toBe('YEAR')
    expect(res.periodEnd).toEqual(futureEnd)
  })
})
