'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CalendarDays, LayoutList, Rows3 } from 'lucide-react'
import { canManageBookings, useWorkspaceRole } from '@/components/layout/workspace-context'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'

/** The calendar page's two views: the month grid and the room timeline (room-timeline.tsx). */
export type CalendarView = 'month' | 'rooms'
export type BookingsView = 'list' | CalendarView

/** The calendar's ?view=, when it names one of its views. */
export function calendarViewParam(value: string | null | undefined): CalendarView | null {
  return value === 'month' || value === 'rooms' ? value : null
}

const VIEWS: { value: BookingsView; icon: typeof LayoutList }[] = [
  { value: 'list', icon: LayoutList },
  { value: 'month', icon: CalendarDays },
  { value: 'rooms', icon: Rows3 },
]

/**
 * "Danh sách | Lịch tháng | Sơ đồ phòng" under the header of the bookings
 * list and of the calendar: one menu entry ("Đặt phòng", nav.ts), three ways
 * to look at the bookings. The list is /bookings, the other two
 * /calendar?view=…; the calendar passes `onCalendarView` to switch in place.
 * The calendar is for staff (it was theirs in the menu): a USER has the list
 * alone, so no switcher.
 */
export function BookingsViews({
  slug,
  propertyId,
  current,
  onCalendarView,
  className,
}: {
  slug: string
  propertyId: string
  current: BookingsView
  onCalendarView?: (view: CalendarView) => void
  className?: string
}) {
  const t = useTranslations('dash.bookings.views')
  const role = useWorkspaceRole()
  const router = useRouter()
  const staff = canManageBookings(role)

  const hrefOf = React.useCallback(
    (view: BookingsView) =>
      view === 'list' ? routes.propertyBookings(slug, propertyId) : `${routes.propertyCalendar(slug, propertyId)}?view=${view}`,
    [slug, propertyId]
  )
  // The other page is one click away: have it ready.
  React.useEffect(() => {
    if (staff) router.prefetch(hrefOf(current === 'list' ? 'month' : 'list'))
  }, [staff, current, hrefOf, router])

  if (!staff) return null

  const choose = (view: BookingsView) => {
    if (view === current) return
    if (view !== 'list' && onCalendarView) onCalendarView(view)
    else router.push(hrefOf(view))
  }

  return (
    <div
      role="tablist"
      aria-label={t('label')}
      className={cn('flex w-fit max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden p-0.5 bg-plain-soft rounded-ctl', className)}
    >
      {VIEWS.map(({ value, icon: Icon }) => {
        const active = value === current
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => choose(value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 px-3 h-9 sm:h-8 shrink-0 whitespace-nowrap rounded-[calc(var(--ds-r-ctl)-2px)] text-small font-medium',
              'transition-colors duration-160 ease-ds focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
              active ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t(value)}
          </button>
        )
      })}
    </div>
  )
}
