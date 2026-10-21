'use client'

import * as React from 'react'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Textarea } from '@/components/ui'
import { formatVnd } from '@/lib/bookings/display'

interface Preview {
  hoursLate: number
  percent: number
  suggestedFee: number
  checkOutTime: string
}

type Decision = 'apply' | 'edit' | 'waive'

/**
 * Check-out with the late fee the hotel's policy suggests
 * (GET /api/bookings/[id]/check-out): the front desk applies it, charges
 * another amount or waives it; those two need a reason, which is logged.
 * Used by the booking panel/page and the calendar.
 */
export function CheckOutDialog({
  bookingId,
  bookingCode,
  isOpen,
  onClose,
  onDone,
}: {
  bookingId: string
  bookingCode: string
  isOpen: boolean
  onClose: () => void
  /** after a successful check-out, with the server's message */
  onDone: (message: string) => void
}) {
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [decision, setDecision] = React.useState<Decision>('apply')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen) return
    setPreview(null)
    setDecision('apply')
    setAmount('')
    setReason('')
    setError('')
    let alive = true
    fetch(`/api/bookings/${bookingId}/check-out`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d.success) setPreview(d.data)
        else setError(d.error || 'Không tính được phí trả phòng')
      })
      .catch(() => alive && setError('Không kết nối được máy chủ'))
    return () => {
      alive = false
    }
  }, [isOpen, bookingId])

  const late = (preview?.suggestedFee ?? 0) > 0
  const needsReason = late && decision !== 'apply'

  const submit = async () => {
    if (needsReason && reason.trim().length < 3) {
      setError('Ghi lý do khi sửa hoặc miễn phí trả muộn')
      return
    }
    if (late && decision === 'edit' && !(Number(amount) >= 0 && amount !== '')) {
      setError('Nhập số tiền phụ thu')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/bookings/${bookingId}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          late
            ? {
                lateFee: {
                  decision,
                  ...(decision === 'edit' && { amount: Math.round(Number(amount)) }),
                  ...(decision !== 'apply' && { reason: reason.trim() }),
                },
              }
            : {}
        ),
      })
      const data = await res.json()
      if (data.success) onDone(data.message || 'Đã trả phòng')
      else setError(data.error || 'Thao tác không thành công')
    } catch {
      setError('Không kết nối được máy chủ')
    } finally {
      setBusy(false)
    }
  }

  const option = (value: Decision, label: string) => (
    <label className="flex items-center gap-2 text-small text-fg">
      <input type="radio" name="late-fee" checked={decision === value} onChange={() => setDecision(value)} className="w-4 h-4" />
      {label}
    </label>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader onClose={onClose}>
        <span className="font-semibold">Trả phòng {bookingCode}</span>
      </ModalHeader>
      <ModalBody>
        {!preview && !error && <p className="text-small text-muted">Đang tính phí trả phòng…</p>}
        {preview && !late && (
          <p className="text-small text-fg">Khách trả phòng đúng giờ (trước {preview.checkOutTime} ngày trả đã đặt): không có phụ thu.</p>
        )}
        {preview && late && (
          <div className="space-y-3">
            <p className="text-small text-fg rounded-ctl bg-warn-soft px-3 py-2">
              Trả muộn {preview.hoursLate} giờ so với {preview.checkOutTime} ngày trả đã đặt. Theo chính sách: phụ thu{' '}
              {preview.percent}% giá một đêm = <strong>{formatVnd(preview.suggestedFee)}</strong>.
            </p>
            <div className="space-y-2" role="radiogroup" aria-label="Phí trả phòng muộn">
              {option('apply', `Áp dụng ${formatVnd(preview.suggestedFee)}`)}
              {option('edit', 'Thu số khác')}
              {decision === 'edit' && (
                <Input
                  type="number"
                  min={0}
                  label="Số tiền phụ thu (đồng)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              )}
              {option('waive', 'Miễn phí trả muộn')}
            </div>
            {needsReason && (
              <Textarea label="Lý do (bắt buộc, lưu vào nhật ký)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            )}
          </div>
        )}
        {error && <p className="text-small text-err">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Đóng
        </Button>
        <Button isLoading={busy} disabled={!preview} onClick={submit}>
          Trả phòng
        </Button>
      </ModalFooter>
    </Modal>
  )
}
