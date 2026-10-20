'use client'

import * as React from 'react'
import { Check, Copy, MoreHorizontal, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PaymentStatusBadge,
  Textarea,
  toast,
} from '@/components/ui'
import { canManageBookings, useWorkspaceRole } from '@/components/layout/workspace-context'
import {
  buildPrintHtml,
  formatDateTime,
  formatLongDate,
  formatVnd,
  guestsLabel,
  nightsBetween,
  paymentMethodLabel,
  remainingAmount,
} from '@/lib/bookings/display'

/**
 * A booking's details and actions, shared by the side panel on the bookings
 * list (redesign 4b/4d) and the booking's own page.
 */

export interface BookingDetailData {
  id: string
  bookingCode: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestNote: string | null
  checkInDate: string
  checkOutDate: string
  numAdults: number
  numChildren: number
  status: string
  subtotal: number
  extraCharges: number
  discount: number
  totalAmount: number
  depositAmount: number
  paymentStatus: string
  actualCheckIn: string | null
  actualCheckOut: string | null
  vatCompany: string | null
  vatTaxCode: string | null
  vatAddress: string | null
  vatEmail: string | null
  source: string
  createdAt: string
  bookingItems: { id: string; roomTypeId: string; roomTypeName: string | null; roomNumber: string | null }[]
  property: {
    id: string
    name: string
    address?: string | null
    phone?: string | null
    policy?: { checkInTime: string | null; checkOutTime: string | null } | null
  }
  payments: { id: string; amount: number; method: string; status: string; paidAt: string | null; createdAt: string }[]
}

/** Loads one booking; `reload` refetches after an action. */
export function useBooking(bookingId: string | null) {
  const [booking, setBooking] = React.useState<BookingDetailData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!bookingId) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/bookings/${bookingId}`, { signal })
        const data = await res.json()
        if (signal?.aborted) return
        if (data.success) setBooking(data.data)
        else setError(data.error || 'Không tải được đặt phòng')
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError('Không tải được đặt phòng')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [bookingId]
  )

  React.useEffect(() => {
    setBooking(null)
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { booking, loading, error, reload: () => load() }
}

export function roomLabel(booking: Pick<BookingDetailData, 'bookingItems'>): string {
  const item = booking.bookingItems[0]
  if (!item) return 'Chưa có phòng'
  const name = item.roomTypeName ?? 'Hạng phòng đã xoá'
  const more = booking.bookingItems.length > 1 ? ` (+${booking.bookingItems.length - 1} phòng)` : ''
  return `${name}${item.roomNumber ? ` · ${item.roomNumber}` : ''}${more}`
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-5 first:pt-0 border-b border-line last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-label uppercase text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1 text-small">
      <dt className="text-muted">{label}</dt>
      <dd className="text-fg min-w-0 break-words">{children}</dd>
    </div>
  )
}

function MoneyRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'warn' }) {
  return (
    <div className={cn('flex justify-between gap-3 py-1 text-small tabular-nums', strong && 'font-semibold text-body')}>
      <span className={strong ? 'text-fg' : 'text-muted'}>{label}</span>
      <span className={cn('text-fg whitespace-nowrap', tone === 'warn' && 'text-warn')}>{value}</span>
    </div>
  )
}

export function BookingDetailContent({ booking, onChanged }: { booking: BookingDetailData; onChanged: () => void }) {
  const role = useWorkspaceRole()
  const nights = nightsBetween(booking.checkInDate, booking.checkOutDate)
  const remaining = remainingAmount(booking)
  const checkInTime = booking.property.policy?.checkInTime || '14:00'
  const checkOutTime = booking.property.policy?.checkOutTime || '12:00'

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(booking.guestPhone)
      toast.success('Đã sao chép số điện thoại')
    } catch {
      toast.error('Không sao chép được', booking.guestPhone)
    }
  }

  return (
    <div>
      <Section title="Khách">
        <p className="text-body font-medium text-fg">{booking.guestName}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-small text-fg tabular-nums">{booking.guestPhone}</span>
          <span className="flex gap-1.5">
            <a
              href={`tel:${booking.guestPhone.replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 rounded-ctl border border-line text-small text-fg hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              Gọi
            </a>
            <Button variant="outline" size="sm" onClick={copyPhone}>
              <Copy className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              Sao chép
            </Button>
          </span>
        </div>
        <dl className="mt-2">
          <Field label="Email">
            <a href={`mailto:${booking.guestEmail}`} className="hover:underline">
              {booking.guestEmail}
            </a>
          </Field>
          <Field label="Số khách">{guestsLabel(booking.numAdults, booking.numChildren)}</Field>
        </dl>
        {booking.guestNote && (
          <p className="mt-2 rounded-ctl bg-fg/5 px-3 py-2 text-small text-fg">
            <span className="text-muted">Ghi chú: </span>
            {booking.guestNote}
          </p>
        )}
      </Section>

      <Section title="Phòng">
        <dl>
          <Field label="Loại phòng">
            {booking.bookingItems.length === 0
              ? 'Chưa có phòng'
              : booking.bookingItems[0].roomTypeName ?? 'Hạng phòng đã xoá'}
          </Field>
          <Field label="Số phòng">
            <RoomNumber booking={booking} onChanged={onChanged} editable={canManageBookings(role)} />
          </Field>
          <Field label="Nhận phòng">
            {formatLongDate(booking.checkInDate)} · {checkInTime}
            {booking.actualCheckIn && (
              <span className="block text-ok">Đã nhận lúc {formatDateTime(booking.actualCheckIn)}</span>
            )}
          </Field>
          <Field label="Trả phòng">
            {formatLongDate(booking.checkOutDate)} · {checkOutTime}
            {booking.actualCheckOut && (
              <span className="block text-muted">Đã trả lúc {formatDateTime(booking.actualCheckOut)}</span>
            )}
          </Field>
          <Field label="Số đêm">{nights} đêm</Field>
        </dl>
      </Section>

      <Section title="Tiền">
        <MoneyRow label="Tiền phòng" value={formatVnd(booking.subtotal)} />
        {booking.extraCharges > 0 && <MoneyRow label="Phụ phí" value={formatVnd(booking.extraCharges)} />}
        {booking.discount > 0 && <MoneyRow label="Giảm giá" value={`−${formatVnd(booking.discount)}`} />}
        <div className="my-2 border-t border-line" />
        <MoneyRow label="Tổng cộng" value={formatVnd(booking.totalAmount)} strong />
        <MoneyRow label="Đã thanh toán" value={formatVnd(booking.depositAmount)} />
        <MoneyRow
          label="Còn lại"
          value={formatVnd(remaining)}
          strong
          tone={remaining > 0 && booking.status !== 'CANCELLED' ? 'warn' : undefined}
        />

        <h4 className="mt-4 mb-2 text-small font-medium text-fg">Các lần thanh toán</h4>
        {booking.payments.length === 0 ? (
          <p className="text-small text-muted">Chưa có lần thanh toán nào.</p>
        ) : (
          <ul className="space-y-2">
            {booking.payments.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 rounded-ctl border border-line px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-small text-fg">{paymentMethodLabel(p.method)}</span>
                  <span className="block text-xs text-muted">{formatDateTime(p.paidAt ?? p.createdAt)}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-small font-medium tabular-nums whitespace-nowrap">{formatVnd(p.amount)}</span>
                  <PaymentStatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {booking.vatCompany && (
        <Section title="Xuất hóa đơn công ty">
          <dl>
            <Field label="Tên công ty">{booking.vatCompany}</Field>
            {booking.vatTaxCode && <Field label="MST">{booking.vatTaxCode}</Field>}
            {booking.vatAddress && <Field label="Địa chỉ">{booking.vatAddress}</Field>}
            {booking.vatEmail && <Field label="Email">{booking.vatEmail}</Field>}
          </dl>
        </Section>
      )}
    </div>
  )
}

function RoomNumber({ booking, onChanged, editable }: { booking: BookingDetailData; onChanged: () => void; editable: boolean }) {
  const current = booking.bookingItems[0]?.roomNumber ?? ''
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(current)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => setValue(current), [current])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber: value.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Đã gán số phòng')
        setEditing(false)
        onChanged()
      } else {
        toast.error('Không gán được số phòng', data.error)
      }
    } catch {
      toast.error('Không gán được số phòng')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        {current || <span className="text-muted">Chưa gán</span>}
        {editable && (
          <button type="button" onClick={() => setEditing(true)} className="text-small text-acc hover:underline focus:outline-none focus-visible:underline">
            {current ? 'Sửa' : 'Gán phòng'}
          </button>
        )}
      </span>
    )
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) save()
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="VD: 203" aria-label="Số phòng" className="h-9 sm:h-8 w-28" autoFocus />
      <Button type="submit" size="sm" isLoading={saving} disabled={!value.trim()} aria-label="Lưu số phòng">
        <Check className="w-3.5 h-3.5" aria-hidden="true" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => { setValue(current); setEditing(false) }}>
        Hủy
      </Button>
    </form>
  )
}

type ActionKey = 'checkin' | 'checkout' | 'noshow' | 'cancel' | 'extend' | 'email'

async function postAction(bookingId: string, path: string, body?: unknown) {
  const res = await fetch(`/api/bookings/${bookingId}/${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

function addDays(iso: string, days: number): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000 + days * 86400 * 1000)
  return d.toISOString().slice(0, 10)
}

/**
 * The main action for the booking's state plus the secondary ones
 * (redesign 4b): CONFIRMED / PENDING → Nhận phòng, CHECKED_IN → Trả phòng.
 * `openPageHref` adds "Mở trang đầy đủ" (side panel only).
 */
export function BookingActions({
  booking,
  onChanged,
  openPageHref,
}: {
  booking: BookingDetailData
  onChanged: () => void
  openPageHref?: string
}) {
  const role = useWorkspaceRole()
  const canManage = canManageBookings(role)
  const [busy, setBusy] = React.useState<ActionKey | null>(null)
  const [dialog, setDialog] = React.useState<'cancel' | 'extend' | 'noshow' | null>(null)
  const [cancelReason, setCancelReason] = React.useState('')
  const [extendDate, setExtendDate] = React.useState('')
  const [dialogError, setDialogError] = React.useState('')

  const s = booking.status
  const canCheckIn = s === 'PENDING' || s === 'CONFIRMED'
  const canCheckOut = s === 'CHECKED_IN'
  const canExtend = s === 'CONFIRMED' || s === 'CHECKED_IN'
  const canNoShow = s === 'PENDING' || s === 'CONFIRMED'
  const canCancel = s === 'PENDING' || s === 'CONFIRMED' || s === 'CHECKED_IN'

  const run = async (key: ActionKey, path: string, body: unknown, success: (data: any) => string) => {
    setBusy(key)
    setDialogError('')
    try {
      const data = await postAction(booking.id, path, body)
      if (data.success) {
        toast.success(success(data))
        setDialog(null)
        onChanged()
      } else if (dialog) {
        setDialogError(data.error || 'Thao tác không thành công')
      } else {
        toast.error('Thao tác không thành công', data.error)
      }
    } catch {
      toast.error('Không kết nối được máy chủ')
    } finally {
      setBusy(null)
    }
  }

  const print = () => {
    const html = buildPrintHtml({ ...booking, roomLabel: roomLabel(booking), property: booking.property })
    const w = window.open('', '_blank')
    if (!w) {
      toast.error('Trình duyệt chặn cửa sổ in', 'Cho phép cửa sổ bật lên rồi thử lại.')
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => {
      w.print()
      w.close()
    }, 250)
  }

  const openExtend = () => {
    setExtendDate(addDays(booking.checkOutDate, 1))
    setDialogError('')
    setDialog('extend')
  }

  const primary = !canManage
    ? null
    : canCheckIn
      ? { label: 'Nhận phòng', key: 'checkin' as const, run: () => run('checkin', 'check-in', undefined, () => 'Đã nhận phòng') }
      : canCheckOut
        ? {
            label: 'Trả phòng',
            key: 'checkout' as const,
            run: () => run('checkout', 'check-out', undefined, (d) => d.message || 'Đã trả phòng'),
          }
        : null

  return (
    <>
      {primary ? (
        <Button className="flex-1" onClick={primary.run} isLoading={busy === primary.key} disabled={!!busy && busy !== primary.key}>
          {primary.label}
        </Button>
      ) : (
        <Button variant="outline" className="flex-1" onClick={print}>
          In phiếu
        </Button>
      )}
      {canManage && canExtend && (
        <Button variant="outline" onClick={openExtend} disabled={!!busy}>
          Gia hạn
        </Button>
      )}
      {primary && (
        <Button variant="outline" onClick={print} className="hidden sm:inline-flex">
          In phiếu
        </Button>
      )}
      <Dropdown
        align="right"
        className="bottom-full mb-2 mt-0"
        trigger={
          <Button variant="outline" aria-label="Thao tác khác" className="px-3">
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          </Button>
        }
      >
        {primary && (
          <DropdownItem onClick={print} className="sm:hidden">
            In phiếu
          </DropdownItem>
        )}
        {canManage && (
          <DropdownItem
            disabled={busy === 'email'}
            onClick={() => run('email', 'send-confirmation', undefined, () => 'Đã gửi email xác nhận')}
          >
            Gửi email xác nhận
          </DropdownItem>
        )}
        {canManage && canNoShow && (
          <DropdownItem onClick={() => { setDialogError(''); setDialog('noshow') }}>Đánh dấu không đến</DropdownItem>
        )}
        {openPageHref && (
          <DropdownItem onClick={() => window.location.assign(openPageHref)}>Mở trang đầy đủ</DropdownItem>
        )}
        {/* Dropdown clones each direct child, so no fragments here. */}
        {canManage && canCancel && <DropdownDivider />}
        {canManage && canCancel && (
          <DropdownItem danger onClick={() => { setCancelReason(''); setDialogError(''); setDialog('cancel') }}>
            Hủy đặt phòng
          </DropdownItem>
        )}
      </Dropdown>

      <Modal isOpen={dialog === 'cancel'} onClose={() => setDialog(null)} size="sm">
        <ModalHeader onClose={() => setDialog(null)}>
          <span className="font-semibold">Hủy đặt phòng {booking.bookingCode}?</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-small text-muted">Không hoàn tác được.</p>
          {booking.depositAmount > 0 && (
            <p className="text-small text-fg rounded-ctl bg-info-soft px-3 py-2">
              Khách đã thanh toán {formatVnd(booking.depositAmount)}. Số tiền hoàn (nếu có) tính theo chính sách hủy.
            </p>
          )}
          <Textarea
            label="Lý do hủy (tùy chọn)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
          {dialogError && <p className="text-small text-err">{dialogError}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Không
          </Button>
          <Button
            variant="danger"
            isLoading={busy === 'cancel'}
            onClick={() =>
              run('cancel', 'cancel', { reason: cancelReason }, (d) =>
                d.refundInfo?.refundAmount ? `Đã hủy. Hoàn ${formatVnd(d.refundInfo.refundAmount)}` : 'Đã hủy đặt phòng'
              )
            }
          >
            Hủy đặt phòng
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={dialog === 'extend'} onClose={() => setDialog(null)} size="sm">
        <ModalHeader onClose={() => setDialog(null)}>
          <span className="font-semibold">Gia hạn {booking.bookingCode}</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-small text-muted">Trả phòng hiện tại: {formatLongDate(booking.checkOutDate)}</p>
          <Input
            type="date"
            label="Ngày trả phòng mới"
            value={extendDate}
            min={addDays(booking.checkOutDate, 1)}
            onChange={(e) => setExtendDate(e.target.value)}
            hint="Phụ thu tính theo giá phòng, ghi nhận là tiền mặt."
          />
          {dialogError && <p className="text-small text-err">{dialogError}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Đóng
          </Button>
          <Button
            isLoading={busy === 'extend'}
            disabled={!extendDate}
            onClick={() =>
              run('extend', 'extend', { newCheckOutDate: extendDate, addPayment: true, paymentMethod: 'CASH' }, (d) => d.message || 'Đã gia hạn')
            }
          >
            Gia hạn
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={dialog === 'noshow'} onClose={() => setDialog(null)} size="sm">
        <ModalHeader onClose={() => setDialog(null)}>
          <span className="font-semibold">Khách không đến?</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-small text-fg">
            Đánh dấu {booking.bookingCode} của {booking.guestName} là không đến. Chỉ làm được từ ngày nhận phòng.
          </p>
          {dialogError && <p className="text-small text-err">{dialogError}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Không
          </Button>
          <Button isLoading={busy === 'noshow'} onClick={() => run('noshow', 'no-show', undefined, () => 'Đã đánh dấu không đến')}>
            Đánh dấu không đến
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
