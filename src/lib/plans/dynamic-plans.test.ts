import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DEFAULT_PLAN_DETAILS,
  getAllPlatformPlans,
  getPlatformPlanDetails,
  getPlatformPlans,
  getPlatformPlanById,
  getPlatformPlanPrice,
} from './dynamic-plans'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    platformPlan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

describe('Dynamic Plans Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has valid defaults for core plans (starter, growth, business)', () => {
    expect(DEFAULT_PLAN_DETAILS.starter.properties).toBe(1)
    expect(DEFAULT_PLAN_DETAILS.starter.rooms).toBe(15)
    expect(DEFAULT_PLAN_DETAILS.starter.hasCustomDomain).toBe(false)
    expect(DEFAULT_PLAN_DETAILS.starter.isPublic).toBe(true)

    expect(DEFAULT_PLAN_DETAILS.growth.properties).toBe(3)
    expect(DEFAULT_PLAN_DETAILS.growth.rooms).toBe(60)
    expect(DEFAULT_PLAN_DETAILS.growth.hasCustomDomain).toBe(true)
    expect(DEFAULT_PLAN_DETAILS.growth.isFeatured).toBe(true)

    expect(DEFAULT_PLAN_DETAILS.business.properties).toBe(10)
    expect(DEFAULT_PLAN_DETAILS.business.rooms).toBe(300)
    expect(DEFAULT_PLAN_DETAILS.business.allowRemoveDigistayBranding).toBe(true)
    expect(DEFAULT_PLAN_DETAILS.business.hasDedicatedOnboarding).toBe(true)
  })

  it('falls back to default plan details when DB record is not found', async () => {
    vi.mocked(prisma.platformPlan.findUnique).mockResolvedValue(null)

    const starter = await getPlatformPlanDetails('starter')
    expect(starter.id).toBe('starter')
    expect(starter.price).toBe(199_000)

    const unknown = await getPlatformPlanDetails('unknown-plan-code')
    // falls back to growth preset
    expect(unknown.id).toBe('growth')
    expect(unknown.price).toBe(399_000)
  })

  it('loads dynamic plan details from database when present', async () => {
    vi.mocked(prisma.platformPlan.findUnique).mockResolvedValue({
      id: 'vip-phuquoc',
      name: 'Gói VIP Phú Quốc',
      description: 'Gói tùy chỉnh riêng cho chuỗi resort Phú Quốc',
      price: 1_500_000,
      priceYearly: 15_000_000,
      trialDays: 30,
      properties: 5,
      rooms: 120,
      maxRoomTypes: 20,
      staff: 25,
      maxMonthlyBookings: -1,
      transactionFeePercent: 0,
      hasCustomDomain: true,
      allowRemoveDigistayBranding: true,
      hasMultiLanguage: true,
      maxCustomPages: 50,
      allowCustomTrackingCode: true,
      monthlyAiContentQuota: 300,
      hasChatbotAi: true,
      monthlyChatbotMessages: 3000,
      hasAiSmartPricing: true,
      hasOtaIcalSync: true,
      maxIcalFeeds: 30,
      hasDirectApiChannels: true,
      hasPayOsOnlineDeposit: true,
      hasCashbookReports: true,
      hasAdvancedAnalytics: true,
      allowDataExport: true,
      invoices: 200,
      maxStorageMb: 10240,
      maxImageUploadSizeMb: 30,
      supportPriority: 'DEDICATED',
      hasDedicatedOnboarding: true,
      isPublic: false,
      isActive: true,
      isFeatured: false,
      displayOrder: 99,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const vip = await getPlatformPlanDetails('vip-phuquoc')
    expect(vip.id).toBe('vip-phuquoc')
    expect(vip.name).toBe('Gói VIP Phú Quốc')
    expect(vip.isPublic).toBe(false)
    expect(vip.rooms).toBe(120)
    expect(vip.allowRemoveDigistayBranding).toBe(true)
    expect(vip.supportPriority).toBe('DEDICATED')
  })

  it('calculates monthly and yearly pricing accurately', async () => {
    vi.mocked(prisma.platformPlan.findUnique).mockResolvedValue({
      id: 'custom-plan',
      name: 'Custom',
      description: null,
      price: 500_000,
      priceYearly: 4_500_000, // special 10% discount on yearly
      trialDays: 14,
      properties: 2,
      rooms: 40,
      maxRoomTypes: 10,
      staff: 5,
      maxMonthlyBookings: -1,
      transactionFeePercent: 0,
      hasCustomDomain: true,
      allowRemoveDigistayBranding: false,
      hasMultiLanguage: true,
      maxCustomPages: 10,
      allowCustomTrackingCode: false,
      monthlyAiContentQuota: 50,
      hasChatbotAi: true,
      monthlyChatbotMessages: 500,
      hasAiSmartPricing: false,
      hasOtaIcalSync: true,
      maxIcalFeeds: 5,
      hasDirectApiChannels: false,
      hasPayOsOnlineDeposit: true,
      hasCashbookReports: true,
      hasAdvancedAnalytics: true,
      allowDataExport: true,
      invoices: 0,
      maxStorageMb: 2048,
      maxImageUploadSizeMb: 10,
      supportPriority: 'STANDARD',
      hasDedicatedOnboarding: false,
      isPublic: true,
      isActive: true,
      isFeatured: false,
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const monthly = await getPlatformPlanPrice('custom-plan', 'MONTH')
    expect(monthly).toBe(500_000)

    const yearly = await getPlatformPlanPrice('custom-plan', 'YEAR')
    expect(yearly).toBe(4_500_000)
  })

  it('filters private plans when includePrivate is false', async () => {
    vi.mocked(prisma.platformPlan.findMany).mockImplementation(async (args?: any) => {
      if (args?.where?.isPublic === true) {
        return [
          { id: 'starter', name: 'Starter', price: 199_000, isPublic: true, isActive: true },
        ] as any
      }
      return [
        { id: 'starter', name: 'Starter', price: 199_000, isPublic: true, isActive: true },
        { id: 'vip-chain', name: 'VIP Chain', price: 2_000_000, isPublic: false, isActive: true },
      ] as any
    })

    const publicOnly = await getAllPlatformPlans({ includePrivate: false })
    expect(publicOnly).toHaveLength(1)
    expect(publicOnly[0].id).toBe('starter')

    const all = await getAllPlatformPlans({ includePrivate: true })
    expect(all).toHaveLength(2)
  })
})
