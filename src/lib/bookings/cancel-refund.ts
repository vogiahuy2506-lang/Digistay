/**
 * The refund a cancellation gets under the hotel's policy (Chính sách):
 * - cancelled at least `cancellationHours` before check-in: everything paid
 *   comes back. Empty means no free cancellation, as the policy page and
 *   the hotel's site tell hotel and guests (the cancel route used to read
 *   it as 24 hours);
 * - later, before the guest arrived: `lateCancelRefundPercent` of it
 *   (0 = nothing, the default);
 * - after check-in: nothing suggested, the hotel decides.
 *
 * Like the late check-out fee this is a suggestion: staff refund it, another
 * amount, or nothing; differing needs a reason, and the suggestion, the
 * amount and the reason are logged (POST /api/bookings/[id]/cancel).
 */

export type RefundRule = 'nothingPaid' | 'free' | 'late' | 'checkedIn'

export interface RefundSuggestion {
  rule: RefundRule
  totalPaid: number
  suggested: number
  /** whole hours from now to check-in; negative once it has passed */
  hoursBefore: number
  /** the free-cancellation window; null: the hotel has none */
  freeHours: number | null
  /** the share suggested, in % of what was paid */
  percent: number
}

export function suggestRefund(input: {
  now: Date
  checkInDate: Date
  status: string
  totalPaid: number
  cancellationHours: number | null | undefined
  lateCancelRefundPercent: number | null | undefined
}): RefundSuggestion {
  const freeHours = input.cancellationHours ?? null
  const hoursBefore = Math.floor((input.checkInDate.getTime() - input.now.getTime()) / (60 * 60 * 1000))
  const base = { totalPaid: input.totalPaid, hoursBefore, freeHours }
  if (input.totalPaid <= 0) return { ...base, rule: 'nothingPaid', suggested: 0, percent: 0 }
  if (input.status === 'CHECKED_IN') return { ...base, rule: 'checkedIn', suggested: 0, percent: 0 }
  if (freeHours !== null && hoursBefore >= freeHours) return { ...base, rule: 'free', suggested: input.totalPaid, percent: 100 }
  const percent = Math.min(100, Math.max(0, Math.round(input.lateCancelRefundPercent ?? 0)))
  return { ...base, rule: 'late', suggested: Math.round((input.totalPaid * percent) / 100), percent }
}
