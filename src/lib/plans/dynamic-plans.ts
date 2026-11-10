import { prisma } from '@/lib/db'
import { PLANS, PLAN_IDS, type Plan, type PlanId } from '@/lib/marketing/plans'

export interface FullPlatformPlan {
  id: string
  name: string
  description: string | null
  price: number
  priceYearly: number
  trialDays: number
  properties: number
  rooms: number
  maxRoomTypes: number
  staff: number
  maxMonthlyBookings: number
  transactionFeePercent: number
  hasCustomDomain: boolean
  allowRemoveDigistayBranding: boolean
  hasMultiLanguage: boolean
  maxCustomPages: number
  allowCustomTrackingCode: boolean
  monthlyAiContentQuota: number
  hasChatbotAi: boolean
  monthlyChatbotMessages: number
  hasAiSmartPricing: boolean
  hasOtaIcalSync: boolean
  maxIcalFeeds: number
  hasDirectApiChannels: boolean
  hasPayOsOnlineDeposit: boolean
  hasCashbookReports: boolean
  hasAdvancedAnalytics: boolean
  allowDataExport: boolean
  invoices: number
  maxStorageMb: number
  maxImageUploadSizeMb: number
  supportPriority: 'STANDARD' | 'PRIORITY' | 'DEDICATED' | string
  hasDedicatedOnboarding: boolean
  isPublic: boolean
  isActive: boolean
  isFeatured: boolean
  displayOrder: number
  createdAt?: Date
  updatedAt?: Date
}

export const DEFAULT_PLAN_DETAILS: Record<PlanId, FullPlatformPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Dành cho homestay, villa, khách sạn nhỏ quản lý 1 cơ sở độc lập.',
    price: 199_000,
    priceYearly: 1_990_000,
    trialDays: 14,
    properties: 1,
    rooms: 15,
    maxRoomTypes: 5,
    staff: 3,
    maxMonthlyBookings: 100,
    transactionFeePercent: 0,
    hasCustomDomain: false,
    allowRemoveDigistayBranding: false,
    hasMultiLanguage: true,
    maxCustomPages: 5,
    allowCustomTrackingCode: false,
    monthlyAiContentQuota: 30,
    hasChatbotAi: true,
    monthlyChatbotMessages: 200,
    hasAiSmartPricing: false,
    hasOtaIcalSync: true,
    maxIcalFeeds: 3,
    hasDirectApiChannels: false,
    hasPayOsOnlineDeposit: true,
    hasCashbookReports: true,
    hasAdvancedAnalytics: false,
    allowDataExport: false,
    invoices: 0,
    maxStorageMb: 1024,
    maxImageUploadSizeMb: 10,
    supportPriority: 'STANDARD',
    hasDedicatedOnboarding: false,
    isPublic: true,
    isActive: true,
    isFeatured: false,
    displayOrder: 1,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    description: 'Phù hợp khách sạn vừa, chuỗi 2-3 homestay, tích hợp đồng bộ đa kênh OTA.',
    price: 399_000,
    priceYearly: 3_990_000,
    trialDays: 14,
    properties: 3,
    rooms: 60,
    maxRoomTypes: 15,
    staff: 10,
    maxMonthlyBookings: 500,
    transactionFeePercent: 0,
    hasCustomDomain: true,
    allowRemoveDigistayBranding: false,
    hasMultiLanguage: true,
    maxCustomPages: 20,
    allowCustomTrackingCode: true,
    monthlyAiContentQuota: 100,
    hasChatbotAi: true,
    monthlyChatbotMessages: 1000,
    hasAiSmartPricing: true,
    hasOtaIcalSync: true,
    maxIcalFeeds: 15,
    hasDirectApiChannels: false,
    hasPayOsOnlineDeposit: true,
    hasCashbookReports: true,
    hasAdvancedAnalytics: true,
    allowDataExport: true,
    invoices: 100,
    maxStorageMb: 5120,
    maxImageUploadSizeMb: 20,
    supportPriority: 'PRIORITY',
    hasDedicatedOnboarding: false,
    isPublic: true,
    isActive: true,
    isFeatured: true,
    displayOrder: 2,
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'Giải pháp hoàn chỉnh cho khách sạn lớn, chuỗi cơ sở với hạn mức phòng cao.',
    price: 799_000,
    priceYearly: 7_990_000,
    trialDays: 14,
    properties: 10,
    rooms: 300,
    maxRoomTypes: -1,
    staff: 30,
    maxMonthlyBookings: -1,
    transactionFeePercent: 0,
    hasCustomDomain: true,
    allowRemoveDigistayBranding: true,
    hasMultiLanguage: true,
    maxCustomPages: -1,
    allowCustomTrackingCode: true,
    monthlyAiContentQuota: 500,
    hasChatbotAi: true,
    monthlyChatbotMessages: 5000,
    hasAiSmartPricing: true,
    hasOtaIcalSync: true,
    maxIcalFeeds: -1,
    hasDirectApiChannels: true,
    hasPayOsOnlineDeposit: true,
    hasCashbookReports: true,
    hasAdvancedAnalytics: true,
    allowDataExport: true,
    invoices: 500,
    maxStorageMb: 20480,
    maxImageUploadSizeMb: 50,
    supportPriority: 'DEDICATED',
    hasDedicatedOnboarding: true,
    isPublic: true,
    isActive: true,
    isFeatured: false,
    displayOrder: 3,
  },
}

/**
 * Returns all plans configured in DB (including custom/private plans for Super Admin).
 */
export async function getAllPlatformPlans(options?: {
  includePrivate?: boolean
  includeInactive?: boolean
}): Promise<FullPlatformPlan[]> {
  try {
    const where: any = {}
    if (!options?.includePrivate) {
      where.isPublic = true
    }
    if (!options?.includeInactive) {
      where.isActive = true
    }

    const rows = await prisma.platformPlan.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
    })

    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price: r.price,
        priceYearly: r.priceYearly ?? r.price * 10,
        trialDays: r.trialDays,
        properties: r.properties,
        rooms: r.rooms,
        maxRoomTypes: r.maxRoomTypes,
        staff: r.staff,
        maxMonthlyBookings: r.maxMonthlyBookings,
        transactionFeePercent: r.transactionFeePercent,
        hasCustomDomain: r.hasCustomDomain,
        allowRemoveDigistayBranding: r.allowRemoveDigistayBranding,
        hasMultiLanguage: r.hasMultiLanguage,
        maxCustomPages: r.maxCustomPages,
        allowCustomTrackingCode: r.allowCustomTrackingCode,
        monthlyAiContentQuota: r.monthlyAiContentQuota,
        hasChatbotAi: r.hasChatbotAi,
        monthlyChatbotMessages: r.monthlyChatbotMessages,
        hasAiSmartPricing: r.hasAiSmartPricing,
        hasOtaIcalSync: r.hasOtaIcalSync,
        maxIcalFeeds: r.maxIcalFeeds,
        hasDirectApiChannels: r.hasDirectApiChannels,
        hasPayOsOnlineDeposit: r.hasPayOsOnlineDeposit,
        hasCashbookReports: r.hasCashbookReports,
        hasAdvancedAnalytics: r.hasAdvancedAnalytics,
        allowDataExport: r.allowDataExport,
        invoices: r.invoices,
        maxStorageMb: r.maxStorageMb,
        maxImageUploadSizeMb: r.maxImageUploadSizeMb,
        supportPriority: r.supportPriority,
        hasDedicatedOnboarding: r.hasDedicatedOnboarding,
        isPublic: r.isPublic,
        isActive: r.isActive,
        isFeatured: r.isFeatured,
        displayOrder: r.displayOrder,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    }
  } catch {
    // If DB offline, fall back cleanly
  }

  return Object.values(DEFAULT_PLAN_DETAILS)
}

/**
 * Returns single plan details by code/id, falling back to standard presets if missing.
 */
export async function getPlatformPlanDetails(id: string): Promise<FullPlatformPlan> {
  try {
    const found = await prisma.platformPlan.findUnique({
      where: { id },
    })
    if (found) {
      return {
        id: found.id,
        name: found.name,
        description: found.description,
        price: found.price,
        priceYearly: found.priceYearly ?? found.price * 10,
        trialDays: found.trialDays,
        properties: found.properties,
        rooms: found.rooms,
        maxRoomTypes: found.maxRoomTypes,
        staff: found.staff,
        maxMonthlyBookings: found.maxMonthlyBookings,
        transactionFeePercent: found.transactionFeePercent,
        hasCustomDomain: found.hasCustomDomain,
        allowRemoveDigistayBranding: found.allowRemoveDigistayBranding,
        hasMultiLanguage: found.hasMultiLanguage,
        maxCustomPages: found.maxCustomPages,
        allowCustomTrackingCode: found.allowCustomTrackingCode,
        monthlyAiContentQuota: found.monthlyAiContentQuota,
        hasChatbotAi: found.hasChatbotAi,
        monthlyChatbotMessages: found.monthlyChatbotMessages,
        hasAiSmartPricing: found.hasAiSmartPricing,
        hasOtaIcalSync: found.hasOtaIcalSync,
        maxIcalFeeds: found.maxIcalFeeds,
        hasDirectApiChannels: found.hasDirectApiChannels,
        hasPayOsOnlineDeposit: found.hasPayOsOnlineDeposit,
        hasCashbookReports: found.hasCashbookReports,
        hasAdvancedAnalytics: found.hasAdvancedAnalytics,
        allowDataExport: found.allowDataExport,
        invoices: found.invoices,
        maxStorageMb: found.maxStorageMb,
        maxImageUploadSizeMb: found.maxImageUploadSizeMb,
        supportPriority: found.supportPriority,
        hasDedicatedOnboarding: found.hasDedicatedOnboarding,
        isPublic: found.isPublic,
        isActive: found.isActive,
        isFeatured: found.isFeatured,
        displayOrder: found.displayOrder,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
      }
    }
  } catch {
    // Fall back to preset
  }

  if (id in DEFAULT_PLAN_DETAILS) {
    return DEFAULT_PLAN_DETAILS[id as PlanId]
  }

  return DEFAULT_PLAN_DETAILS.growth
}

/**
 * Lightweight Plan list for backward compatibility with existing pricing pages and limit checks.
 */
export async function getPlatformPlans(): Promise<Plan[]> {
  const all = await getAllPlatformPlans({ includePrivate: false, includeInactive: false })
  return all.map((p) => ({
    id: (PLAN_IDS.includes(p.id as any) ? p.id : 'growth') as PlanId,
    price: p.price,
    properties: p.properties,
    rooms: p.rooms,
    staff: p.staff,
    invoices: p.invoices,
  }))
}

export async function getPlatformPlanById(id: string): Promise<Plan> {
  const details = await getPlatformPlanDetails(id)
  return {
    id: (PLAN_IDS.includes(details.id as any) ? details.id : 'growth') as PlanId,
    price: details.price,
    properties: details.properties,
    rooms: details.rooms,
    staff: details.staff,
    invoices: details.invoices,
  }
}

export async function getPlatformPlanPrice(plan: string, billing: 'MONTH' | 'YEAR'): Promise<number> {
  const p = await getPlatformPlanDetails(plan)
  return billing === 'YEAR' ? (p.priceYearly || p.price * 10) : p.price
}
