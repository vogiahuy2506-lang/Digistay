import { NextRequest, NextResponse } from 'next/server'
import { processPostStaySurveys } from '@/lib/reviews/post-stay-survey'
import { recordJobRun } from '@/lib/ops/job-runs'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/post-stay-survey
 * Quét các đơn đặt phòng đã kết thúc lưu trú (check-out 24h - 7 ngày trước),
 * đánh dấu postStayEmailSentAt và gửi email cảm ơn + xin đánh giá.
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  const summary = await recordJobRun('post-stay-survey', () => processPostStaySurveys())
  console.log(`[post-stay-survey] job summary: ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
