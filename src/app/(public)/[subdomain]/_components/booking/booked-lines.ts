import type { getTranslations } from 'next-intl/server'
import type { DepositView } from '@/lib/payments/deposit-view'
import type { SummaryLine } from './StaySummary'

/** The summary lines of a booking already made (deposit-view.ts). */
export function bookedLines(view: DepositView, t: Awaited<ReturnType<typeof getTranslations<'site'>>>): SummaryLine[] {
  return [
    { label: t('booking.common.roomPrice', { nights: t('units.nights', { count: view.nights }) }), amount: view.amounts.room },
    ...(view.amounts.extraGuests > 0 ? [{ label: t('booking.common.extraGuests'), amount: view.amounts.extraGuests }] : []),
    ...view.amounts.services.map((s) => ({ label: `${s.name} × ${s.quantity}`, amount: s.amount })),
  ]
}
