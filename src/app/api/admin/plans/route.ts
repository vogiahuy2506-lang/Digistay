import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { getAllPlatformPlans } from '@/lib/plans/dynamic-plans'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PlanSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, 'Mã gói phải có ít nhất 2 ký tự')
    .max(50, 'Mã gói tối đa 50 ký tự')
    .regex(/^[a-z0-9-]+$/, 'Mã gói chỉ gồm chữ thường không dấu, số và gạch ngang (vd: vip-resort-2026)'),
  name: z.string().trim().min(2, 'Tên gói ít nhất 2 ký tự').max(100),
  description: z.string().trim().max(500).optional().nullable(),
  price: z.number().int().min(0, 'Giá tháng không âm').max(1_000_000_000),
  priceYearly: z.number().int().min(0, 'Giá năm không âm').max(10_000_000_000).optional().nullable(),
  trialDays: z.number().int().min(0).max(365).default(14),

  // Quy mô & Cơ sở vật chất
  properties: z.number().int().min(-1).max(10000).default(1),
  rooms: z.number().int().min(-1).max(50000).default(15),
  maxRoomTypes: z.number().int().min(-1).max(5000).default(5),
  staff: z.number().int().min(-1).max(5000).default(3),

  // Đặt phòng & Doanh số
  maxMonthlyBookings: z.number().int().min(-1).max(1_000_000).default(-1),
  transactionFeePercent: z.number().min(0).max(100).default(0),

  // Website & Nhận diện
  hasCustomDomain: z.boolean().default(false),
  allowRemoveDigistayBranding: z.boolean().default(false),
  hasMultiLanguage: z.boolean().default(true),
  maxCustomPages: z.number().int().min(-1).max(1000).default(5),
  allowCustomTrackingCode: z.boolean().default(false),

  // AI & Tự động hoá
  monthlyAiContentQuota: z.number().int().min(-1).max(100000).default(30),
  hasChatbotAi: z.boolean().default(true),
  monthlyChatbotMessages: z.number().int().min(-1).max(1_000_000).default(200),
  hasAiSmartPricing: z.boolean().default(false),

  // Kênh bán & OTA
  hasOtaIcalSync: z.boolean().default(true),
  maxIcalFeeds: z.number().int().min(-1).max(1000).default(5),
  hasDirectApiChannels: z.boolean().default(false),

  // Tài chính & Sổ quỹ
  hasPayOsOnlineDeposit: z.boolean().default(true),
  hasCashbookReports: z.boolean().default(true),
  hasAdvancedAnalytics: z.boolean().default(true),
  allowDataExport: z.boolean().default(true),
  invoices: z.number().int().min(0).max(500000).default(0),

  // Lưu trữ & Hỗ trợ SLA
  maxStorageMb: z.number().int().min(100).max(1_000_000).default(1024),
  maxImageUploadSizeMb: z.number().int().min(1).max(500).default(10),
  supportPriority: z.enum(['STANDARD', 'PRIORITY', 'DEDICATED']).default('STANDARD'),
  hasDedicatedOnboarding: z.boolean().default(false),

  // Phân loại
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
})

/**
 * GET /api/admin/plans — Super Admin lists ALL plans (public & custom private).
 */
export async function GET() {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const plans = await getAllPlatformPlans({ includePrivate: true, includeInactive: true })
  return NextResponse.json({ success: true, data: plans })
}

/**
 * POST /api/admin/plans — Super Admin creates a new standard or custom private plan.
 */
export async function POST(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = PlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Dữ liệu gói cước không hợp lệ', details: parsed.error.format() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const existing = await prisma.platformPlan.findUnique({
    where: { id: data.id },
  })
  if (existing) {
    return NextResponse.json(
      { success: false, error: `Mã gói "${data.id}" đã tồn tại. Vui lòng chọn mã khác.` },
      { status: 409 }
    )
  }

  const created = await prisma.platformPlan.create({
    data: {
      id: data.id,
      name: data.name,
      description: data.description,
      price: data.price,
      priceYearly: data.priceYearly ?? data.price * 10,
      trialDays: data.trialDays,
      properties: data.properties,
      rooms: data.rooms,
      maxRoomTypes: data.maxRoomTypes,
      staff: data.staff,
      maxMonthlyBookings: data.maxMonthlyBookings,
      transactionFeePercent: data.transactionFeePercent,
      hasCustomDomain: data.hasCustomDomain,
      allowRemoveDigistayBranding: data.allowRemoveDigistayBranding,
      hasMultiLanguage: data.hasMultiLanguage,
      maxCustomPages: data.maxCustomPages,
      allowCustomTrackingCode: data.allowCustomTrackingCode,
      monthlyAiContentQuota: data.monthlyAiContentQuota,
      hasChatbotAi: data.hasChatbotAi,
      monthlyChatbotMessages: data.monthlyChatbotMessages,
      hasAiSmartPricing: data.hasAiSmartPricing,
      hasOtaIcalSync: data.hasOtaIcalSync,
      maxIcalFeeds: data.maxIcalFeeds,
      hasDirectApiChannels: data.hasDirectApiChannels,
      hasPayOsOnlineDeposit: data.hasPayOsOnlineDeposit,
      hasCashbookReports: data.hasCashbookReports,
      hasAdvancedAnalytics: data.hasAdvancedAnalytics,
      allowDataExport: data.allowDataExport,
      invoices: data.invoices,
      maxStorageMb: data.maxStorageMb,
      maxImageUploadSizeMb: data.maxImageUploadSizeMb,
      supportPriority: data.supportPriority,
      hasDedicatedOnboarding: data.hasDedicatedOnboarding,
      isPublic: data.isPublic,
      isActive: data.isActive,
      isFeatured: data.isFeatured,
      displayOrder: data.displayOrder,
    },
  })

  // Audit log
  try {
    await prisma.activityLog.create({
      data: {
        userId: check.admin.id,
        action: 'CREATE_PLAN',
        entityType: 'PLATFORM_PLAN',
        entityId: created.id,
        metadata: { name: created.name, price: created.price, isPublic: created.isPublic },
      },
    })
  } catch {
    // Non-fatal if audit log fails
  }

  return NextResponse.json({ success: true, data: created })
}

/**
 * PUT /api/admin/plans — Super Admin updates a plan's price and limits.
 */
export async function PUT(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = PlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Dữ liệu gói không hợp lệ', details: parsed.error.format() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const updated = await prisma.platformPlan.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      name: data.name,
      description: data.description,
      price: data.price,
      priceYearly: data.priceYearly ?? data.price * 10,
      trialDays: data.trialDays,
      properties: data.properties,
      rooms: data.rooms,
      maxRoomTypes: data.maxRoomTypes,
      staff: data.staff,
      maxMonthlyBookings: data.maxMonthlyBookings,
      transactionFeePercent: data.transactionFeePercent,
      hasCustomDomain: data.hasCustomDomain,
      allowRemoveDigistayBranding: data.allowRemoveDigistayBranding,
      hasMultiLanguage: data.hasMultiLanguage,
      maxCustomPages: data.maxCustomPages,
      allowCustomTrackingCode: data.allowCustomTrackingCode,
      monthlyAiContentQuota: data.monthlyAiContentQuota,
      hasChatbotAi: data.hasChatbotAi,
      monthlyChatbotMessages: data.monthlyChatbotMessages,
      hasAiSmartPricing: data.hasAiSmartPricing,
      hasOtaIcalSync: data.hasOtaIcalSync,
      maxIcalFeeds: data.maxIcalFeeds,
      hasDirectApiChannels: data.hasDirectApiChannels,
      hasPayOsOnlineDeposit: data.hasPayOsOnlineDeposit,
      hasCashbookReports: data.hasCashbookReports,
      hasAdvancedAnalytics: data.hasAdvancedAnalytics,
      allowDataExport: data.allowDataExport,
      invoices: data.invoices,
      maxStorageMb: data.maxStorageMb,
      maxImageUploadSizeMb: data.maxImageUploadSizeMb,
      supportPriority: data.supportPriority,
      hasDedicatedOnboarding: data.hasDedicatedOnboarding,
      isPublic: data.isPublic,
      isActive: data.isActive,
      isFeatured: data.isFeatured,
      displayOrder: data.displayOrder,
    },
    update: {
      name: data.name,
      description: data.description,
      price: data.price,
      priceYearly: data.priceYearly ?? data.price * 10,
      trialDays: data.trialDays,
      properties: data.properties,
      rooms: data.rooms,
      maxRoomTypes: data.maxRoomTypes,
      staff: data.staff,
      maxMonthlyBookings: data.maxMonthlyBookings,
      transactionFeePercent: data.transactionFeePercent,
      hasCustomDomain: data.hasCustomDomain,
      allowRemoveDigistayBranding: data.allowRemoveDigistayBranding,
      hasMultiLanguage: data.hasMultiLanguage,
      maxCustomPages: data.maxCustomPages,
      allowCustomTrackingCode: data.allowCustomTrackingCode,
      monthlyAiContentQuota: data.monthlyAiContentQuota,
      hasChatbotAi: data.hasChatbotAi,
      monthlyChatbotMessages: data.monthlyChatbotMessages,
      hasAiSmartPricing: data.hasAiSmartPricing,
      hasOtaIcalSync: data.hasOtaIcalSync,
      maxIcalFeeds: data.maxIcalFeeds,
      hasDirectApiChannels: data.hasDirectApiChannels,
      hasPayOsOnlineDeposit: data.hasPayOsOnlineDeposit,
      hasCashbookReports: data.hasCashbookReports,
      hasAdvancedAnalytics: data.hasAdvancedAnalytics,
      allowDataExport: data.allowDataExport,
      invoices: data.invoices,
      maxStorageMb: data.maxStorageMb,
      maxImageUploadSizeMb: data.maxImageUploadSizeMb,
      supportPriority: data.supportPriority,
      hasDedicatedOnboarding: data.hasDedicatedOnboarding,
      isPublic: data.isPublic,
      isActive: data.isActive,
      isFeatured: data.isFeatured,
      displayOrder: data.displayOrder,
    },
  })

  // Audit log
  try {
    await prisma.activityLog.create({
      data: {
        userId: check.admin.id,
        action: 'UPDATE_PLAN',
        entityType: 'PLATFORM_PLAN',
        entityId: updated.id,
        metadata: { name: updated.name, price: updated.price, isPublic: updated.isPublic },
      },
    })
  } catch {
    // Non-fatal if audit log fails
  }

  return NextResponse.json({ success: true, data: updated })
}
