'use client'

/**
 * What a notice says (src/lib/notifications.ts), in the reader's language:
 * shared by the bell and the notifications page. Notices are stored as a
 * type and data, so each reader reads them in their own language.
 */
import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'

export interface NoticeItem {
  id: string
  type: string
  data: Record<string, unknown>
  link: string | null
  readAt: string | null
  createdAt: string
}

const PLANS = ['starter', 'growth', 'business'] as const
const USAGE = ['properties', 'rooms', 'staff', 'invoices'] as const
const OVER = ['properties', 'rooms', 'staff'] as const
const LOCKED = ['properties', 'roomTypes', 'members'] as const
const has = (list: readonly string[], value: unknown): value is string => typeof value === 'string' && list.includes(value)

export function useNoticeText() {
  const t = useTranslations('dash.common.notifications')
  const labels = useDashLabels()

  const planName = useCallback((id: unknown) => (has(PLANS, id) ? id.charAt(0).toUpperCase() + id.slice(1) : String(id ?? '')), [])

  const ago = useCallback(
    (iso: string) => {
      const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
      const rtf = new Intl.RelativeTimeFormat(labels.locale === 'en' ? 'en' : 'vi', { numeric: 'auto' })
      if (minutes < 60) return rtf.format(-Math.max(0, minutes), 'minute')
      if (minutes < 24 * 60) return rtf.format(-Math.round(minutes / 60), 'hour')
      return rtf.format(-Math.round(minutes / (24 * 60)), 'day')
    },
    [labels.locale]
  )

  const text = useCallback(
    (item: NoticeItem): { title: string; detail: string } => {
      const d = item.data as {
        bookingCode?: string
        guestName?: string
        propertyName?: string
        checkIn?: string
        checkOut?: string
        total?: number
        amount?: number
        fromWebsite?: boolean
        workspaceName?: string
      }
      const values = { code: d.bookingCode ?? '', guest: d.guestName ?? '', hotel: d.propertyName ?? '' }
      const workspace = d.workspaceName ?? ''
      switch (item.type) {
        case 'booking_new':
          return {
            title: t(d.fromWebsite ? 'bookingNewWebsite' : 'bookingNewStaff', values),
            detail: t('bookingNewDetail', {
              ...values,
              dates: d.checkIn && d.checkOut ? `${labels.dayMonth(d.checkIn)} → ${labels.dayMonth(d.checkOut)}` : '',
              total: labels.money(d.total ?? 0),
            }),
          }
        case 'deposit_paid':
          return { title: t('depositPaid', values), detail: t('depositPaidDetail', { ...values, amount: labels.money(d.amount ?? 0) }) }
        case 'transfer_claimed':
          return { title: t('transferClaimed', values), detail: t('transferClaimedDetail', { ...values, amount: labels.money(d.amount ?? 0) }) }
        case 'workspace_invite': {
          const invite = item.data as { senderName?: string; role?: string; customPermissions?: boolean }
          const role = labels.role(invite.role ?? '')
          return {
            title: t('invite', { sender: invite.senderName ?? '', workspace }),
            detail: t('inviteDetail', { role: invite.customPermissions ? t('inviteCustomRole', { role }) : role }),
          }
        }
        case 'plan_reminder': {
          const p = item.data as { kind?: string; trial?: boolean; plan?: string; periodEnd?: string; locksAt?: string }
          const what = p.trial ? t('planTrial') : t('planNamed', { plan: planName(p.plan) })
          if (p.kind === 'locked') return { title: t('planLocked', { workspace }), detail: t('planLockedDetail') }
          if (p.kind === 'ended') {
            return { title: t('planEnded', { what, workspace }), detail: t('planEndedDetail', { date: p.locksAt ? labels.date(p.locksAt) : '' }) }
          }
          return {
            title: t('planEnding', { what, workspace, date: p.periodEnd ? labels.date(p.periodEnd) : '' }),
            detail: p.trial ? t('planEndingTrialDetail') : t('planEndingDetail'),
          }
        }
        case 'plan_overage': {
          const o = item.data as { state?: string; plan?: string; over?: unknown[]; locksAt?: string; locked?: Record<string, number> }
          if (o.state === 'locked') {
            const what = LOCKED.filter((k) => (o.locked?.[k] ?? 0) > 0).map((k) => t(`planLockedCount.${k}`, { count: o.locked![k] }))
            return { title: t('planOverLocked', { workspace }), detail: t('planOverLockedDetail', { what: what.join(', ') }) }
          }
          const what = (o.over ?? []).filter((k) => has(OVER, k)).map((k) => t(`planOverKind.${k as (typeof OVER)[number]}`))
          return {
            title: t('planOverGrace', { workspace, plan: planName(o.plan) }),
            detail: t('planOverGraceDetail', { what: what.join(', '), date: o.locksAt ? labels.date(o.locksAt) : '' }),
          }
        }
        case 'plan_usage': {
          const u = item.data as { kind?: string; level?: number; used?: number; limit?: number; plan?: string }
          if (!has(USAGE, u.kind)) break
          const kind = t(`planUsageKind.${u.kind as (typeof USAGE)[number]}`)
          const values = { workspace, kind, used: u.used ?? 0, limit: u.limit ?? 0, plan: planName(u.plan) }
          if (u.level === 100) {
            return { title: t('planUsageFull', values), detail: u.kind === 'invoices' ? t('planUsageFullInvoices') : t('planUsageFullDetail') }
          }
          return { title: t('planUsageNear', values), detail: t('planUsageNearDetail') }
        }
      }
      return { title: t('other'), detail: '' }
    },
    [t, labels, planName]
  )

  return { text, ago }
}
