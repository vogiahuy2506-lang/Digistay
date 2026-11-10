import { prisma } from '@/lib/db'
import { vietnamMonth } from '@/lib/billing/limits'
import { workspacePlan } from '@/lib/billing/subscription'

/**
 * Monthly AI generation limits per workspace plan.
 * - trial: 15 generations
 * - starter: 30 generations / month
 * - growth: 100 generations / month
 * - business / pro: 300 generations / month
 */
export const AI_MONTHLY_LIMITS: Record<string, number> = {
  starter: 30,
  growth: 100,
  business: 300,
  trial: 15,
}

export interface AiQuotaStatus {
  allowed: boolean
  used: number
  limit: number
  planId: string
  isTrial: boolean
  remaining: number
  message?: string
}

/**
 * Checks if a workspace has remaining AI generation quota for the current calendar month.
 */
export async function checkAiMonthlyQuota(workspaceId: string): Promise<AiQuotaStatus> {
  const { planId, subscription } = await workspacePlan(workspaceId)
  const isTrial = !!subscription.trial
  const limitKey = isTrial ? 'trial' : planId
  const limit = AI_MONTHLY_LIMITS[limitKey] ?? 30

  const { start, end } = vietnamMonth()
  const used = await prisma.activityLog.count({
    where: {
      workspaceId,
      action: 'AI_CONTENT_GENERATED',
      createdAt: { gte: start, lt: end },
    },
  })

  const remaining = Math.max(0, limit - used)
  const allowed = used < limit

  let message: string | undefined
  if (!allowed) {
    message = isTrial
      ? `Tài khoản dùng thử đã sử dụng hết ${limit}/${limit} lượt tạo nội dung AI. Vui lòng nâng cấp gói để tiếp tục sử dụng!`
      : `Gói cước ${planId.toUpperCase()} đã sử dụng hết hạn ngạch AI tháng này (${used}/${limit} lượt). Vui lòng nâng cấp gói để nhận thêm lượt tạo AI!`
  }

  return {
    allowed,
    used,
    limit,
    planId,
    isTrial,
    remaining,
    message,
  }
}

/**
 * Records an AI content generation activity log for quota tracking.
 */
export async function recordAiContentGenerated(params: {
  userId: string
  workspaceId: string
  propertyId: string
  contentType: string
  modelUsed: string
  title?: string
}) {
  return prisma.activityLog.create({
    data: {
      userId: params.userId,
      workspaceId: params.workspaceId,
      propertyId: params.propertyId,
      action: 'AI_CONTENT_GENERATED',
      entityType: 'AI_CONTENT',
      entityId: params.propertyId,
      metadata: {
        contentType: params.contentType,
        modelUsed: params.modelUsed,
        title: params.title || '',
      },
    },
  })
}

