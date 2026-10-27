'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Header, PageContainer } from '@/components/layout'
import {
  Alert,
  AlertDescription,
  Badge,
  BookingStatusBadge,
  Button,
  Dropdown,
  DropdownItem,
  Input,
  Loading,
  Select,
  SidePanel,
  SidePanelBody,
  SidePanelFooter,
  SidePanelHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { BookingActions, BookingDetailContent, useBooking } from '@/components/bookings/booking-detail'
import { BookingsViews } from '@/components/bookings/bookings-views'
import { useCan } from '@/components/layout/workspace-context'
import { paymentStatusMeta } from '@/lib/booking-status'
import { bookingSources, nightsBetween } from '@/lib/bookings/display'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { apiError } from '@/lib/i18n/api-errors'
import { planNumbers, roomPlan } from '@/lib/bookings/room-plan'

interface BookingRow {
  id: string
  bookingCode: string
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  status: string
  totalAmount: number
  depositAmount: number
  paymentStatus: string
  source: string
  /** the guest said they transferred a manual deposit (src/lib/payments/manual-deposit.ts) */
  transferClaimedAt?: string | null
  bookingItems: { roomTypeId: string; roomTypeName: string | null; roomNumber: string | null }[]
  /** a stay that changes rooms part way (room-plan.ts) */
  roomSegments?: { roomId: string | null; roomNumber: string; roomTypeId: string; fromDate: string; toDate: string }[]
}

interface ListResponse {
  data: BookingRow[]
  statusCounts: Record<string, number>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const PAGE_SIZE = 20
const tabs = ['ALL', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'] as const

const toneText = { warn: 'text-warn', err: 'text-err' } as Record<string, string>

/** "The guest says they transferred": reception checks the account, then confirms on the booking. */
function ClaimBadge({ row }: { row: BookingRow }) {
  const t = useTranslations('dash.bookings.list')
  if (!row.transferClaimedAt || row.status !== 'PENDING') return null
  return <Badge variant="warn">{t('transferClaimed')}</Badge>
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

type T = ReturnType<typeof useTranslations<'dash.bookings'>>
type Labels = ReturnType<typeof useDashLabels>

function roomText(row: BookingRow, t: T) {
  const item = row.bookingItems[0]
  if (!item) return t('room.none')
  // A stay that changes rooms: its rooms in night order ("101 → 205").
  const number = row.roomSegments?.length ? planNumbers(roomPlan(row)) : item.roomNumber
  return `${item.roomTypeName ?? t('room.deletedType')}${number ? ` · ${number}` : ''}`
}

function datesText(row: BookingRow, labels: Labels) {
  return `${labels.dayMonth(row.checkInDate)} → ${labels.dayMonth(row.checkOutDate)} · ${labels.nights(nightsBetween(row.checkInDate, row.checkOutDate))}`
}

function PaymentText({ row }: { row: BookingRow }) {
  const line = useDashLabels().paymentLine(row)
  return <span className={cn('text-small', line.tone ? toneText[line.tone] : 'text-muted')}>{line.text}</span>
}

export default function BookingsPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  const canCreate = useCan('bookings_create')
  const t = useTranslations('dash.bookings')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()

  const [tab, setTab] = React.useState<(typeof tabs)[number]>('ALL')
  const [search, setSearch] = React.useState('')
  const [source, setSource] = React.useState('')
  const [payment, setPayment] = React.useState('')
  const [page, setPage] = React.useState(1)
  const q = useDebounced(search.trim(), 300)

  const [list, setList] = React.useState<ListResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [reloadKey, setReloadKey] = React.useState(0)
  const [openId, setOpenId] = React.useState<string | null>(null)

  // A new filter starts again from page 1.
  React.useEffect(() => setPage(1), [tab, q, source, payment])

  React.useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ propertyId, counts: '1', page: String(page), limit: String(PAGE_SIZE) })
    if (tab !== 'ALL') query.set('status', tab)
    if (q) query.set('q', q)
    if (source) query.set('source', source)
    if (payment) query.set('paymentStatus', payment)

    setLoading(true)
    setError('')
    fetch(`/api/bookings?${query}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setList(data)
        else setError(apiError(data.error) || t('list.loadError'))
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(t('list.loadError'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [propertyId, tab, q, source, payment, page, reloadKey, t])

  const rows = list?.data ?? []
  const counts = list?.statusCounts
  const pagination = list?.pagination
  const filtered = tab !== 'ALL' || !!q || !!source || !!payment
  const openIndex = rows.findIndex((r) => r.id === openId)

  const detail = useBooking(openId)
  const refreshAll = () => {
    detail.reload()
    setReloadKey((k) => k + 1)
  }

  const clearFilters = () => {
    setTab('ALL')
    setSearch('')
    setSource('')
    setPayment('')
  }

  const newBookingHref = routes.propertyBookingNew(params.slug, propertyId)

  return (
    // Wider than the other pages for the table, but capped: on a 2560 px
    // screen the columns drifted a whole screen apart.
    <PageContainer className="max-w-[1600px]">
      <Header
        eyebrow={labels.longDate(new Date())}
        title={tc('nav.bookings')}
        actions={
          canCreate && (
            <Button onClick={() => router.push(newBookingHref)}>
              <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {t('list.create')}
            </Button>
          )
        }
      />

      {/* The list, the month and the room plan: one menu entry, three views. */}
      <BookingsViews slug={params.slug} propertyId={propertyId} current="list" className="mb-4" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof tabs)[number])}>
        <TabsList variant="underline" className="mb-4">
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key}>
              {key === 'ALL' ? t('list.all') : labels.bookingStatus(key)}
              {counts && <span className="ml-1.5 text-xs text-muted tabular-nums">{counts[key] ?? 0}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
        <div className="sm:w-80">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('list.searchPlaceholder')}
            aria-label={t('list.searchLabel')}
            icon={<Search className="w-4 h-4" aria-hidden="true" />}
          />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Select
            aria-label={t('list.sourceFilter')}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={[{ value: '', label: t('list.allSources') }, ...bookingSources.map((s) => ({ value: s, label: labels.source(s) }))]}
            className="sm:w-44"
          />
          <Select
            aria-label={t('list.paymentFilter')}
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            options={[
              { value: '', label: t('list.allPayments') },
              ...Object.keys(paymentStatusMeta).map((value) => ({ value, label: labels.paymentStatus(value) })),
            ]}
            className="sm:w-52"
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="flex items-center justify-between gap-3">
          <AlertDescription>{error}</AlertDescription>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            {tc('actions.retry')}
          </Button>
        </Alert>
      ) : !list && loading ? (
        <Loading className="py-16" text={t('list.loading')} />
      ) : rows.length === 0 ? (
        <div className="rounded-box border border-line bg-panel px-6 py-14 text-center">
          {filtered ? (
            <>
              <p className="text-body text-fg">{t('list.noMatch')}</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                {t('list.clearFilters')}
              </Button>
            </>
          ) : (
            <>
              <p className="text-body text-fg">{t('list.empty')}</p>
              {canCreate && (
                <Button className="mt-4" onClick={() => router.push(newBookingHref)}>
                  {t('list.createFirst')}
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className={cn('transition-opacity duration-160', loading && 'opacity-60')} aria-busy={loading}>
          {/* Phones: one card per booking (redesign 4c). */}
          <ul className="md:hidden space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(row.id)}
                  className="w-full text-left rounded-box border border-line bg-panel px-4 py-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-body font-medium text-fg truncate">{row.guestName}</span>
                      <span className="block text-xs text-muted font-mono">{row.bookingCode}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <BookingStatusBadge status={row.status} />
                      <ClaimBadge row={row} />
                    </span>
                  </span>
                  <span className="block mt-2 text-small text-fg">{roomText(row, t)}</span>
                  <span className="block text-small text-muted">{datesText(row, labels)}</span>
                  <span className="mt-3 pt-3 border-t border-line flex items-baseline justify-between gap-3">
                    <span className="text-body font-semibold tabular-nums whitespace-nowrap">{labels.money(row.totalAmount)}</span>
                    <PaymentText row={row} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* From md up: the 5-column table (redesign 4a). */}
          <div className="hidden md:block rounded-box border border-line bg-panel overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('list.columns.guest')}</TableHead>
                  <TableHead>{t('list.columns.roomDates')}</TableHead>
                  <TableHead className="text-right">{t('list.columns.total')}</TableHead>
                  <TableHead>{t('list.columns.status')}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t('list.columns.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} selected={row.id === openId} onClick={() => setOpenId(row.id)}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setOpenId(row.id)}
                        className="font-medium text-fg hover:underline focus:outline-none focus-visible:underline text-left"
                      >
                        {row.guestName}
                      </button>
                      <div className="text-xs text-muted">
                        <span className="font-mono">{row.bookingCode}</span> · {labels.source(row.source)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-fg">{roomText(row, t)}</div>
                      <div className="text-xs text-muted">{datesText(row, labels)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-semibold tabular-nums whitespace-nowrap">{labels.money(row.totalAmount)}</div>
                      <PaymentText row={row} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <BookingStatusBadge status={row.status} />
                        <ClaimBadge row={row} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          trigger={
                            <Button variant="ghost" size="sm" aria-label={t('list.rowActions', { code: row.bookingCode })} className="px-2">
                              <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                            </Button>
                          }
                        >
                          <DropdownItem onClick={() => setOpenId(row.id)}>{t('list.viewDetails')}</DropdownItem>
                          <DropdownItem onClick={() => router.push(routes.propertyBooking(params.slug, propertyId, row.id))}>
                            {t('actions.openFullPage')}
                          </DropdownItem>
                        </Dropdown>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination && (
            <div className="mt-4 flex items-center justify-between gap-3 text-small text-muted">
              <span>
                {t('list.range', {
                  from: (pagination.page - 1) * pagination.limit + 1,
                  to: (pagination.page - 1) * pagination.limit + rows.length,
                  total: pagination.total,
                })}
              </span>
              {pagination.totalPages > 1 && (
                <span className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">{t('list.prevPage')}</span>
                  </Button>
                  <span className="tabular-nums">
                    {t('list.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">{t('list.nextPage')}</span>
                  </Button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <SidePanel open={!!openId} onClose={() => setOpenId(null)} label={t('list.panelLabel', { code: detail.booking?.bookingCode ?? '' })}>
        <SidePanelHeader
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="px-2"
                aria-label={t('list.prevBooking')}
                disabled={openIndex <= 0}
                onClick={() => setOpenId(rows[openIndex - 1]?.id ?? null)}
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="px-2"
                aria-label={t('list.nextBooking')}
                disabled={openIndex < 0 || openIndex >= rows.length - 1}
                onClick={() => setOpenId(rows[openIndex + 1]?.id ?? null)}
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </>
          }
        >
          {detail.booking ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold text-fg">{detail.booking.bookingCode}</span>
                <BookingStatusBadge status={detail.booking.status} />
              </div>
              <p className="mt-1 text-small text-muted">
                {labels.source(detail.booking.source)} · {t('detail.bookedAt', { time: labels.dateTime(detail.booking.createdAt) })}
              </p>
            </>
          ) : (
            <span className="text-small text-muted">{tc('states.loading')}</span>
          )}
        </SidePanelHeader>
        <SidePanelBody>
          {detail.error ? (
            <Alert variant="destructive">
              <AlertDescription>{detail.error}</AlertDescription>
            </Alert>
          ) : detail.booking ? (
            <BookingDetailContent booking={detail.booking} onChanged={refreshAll} />
          ) : (
            <Loading className="py-16" />
          )}
        </SidePanelBody>
        {detail.booking && (
          <SidePanelFooter>
            <BookingActions
              booking={detail.booking}
              onChanged={refreshAll}
              openPageHref={routes.propertyBooking(params.slug, propertyId, detail.booking.id)}
            />
          </SidePanelFooter>
        )}
      </SidePanel>
    </PageContainer>
  )
}
