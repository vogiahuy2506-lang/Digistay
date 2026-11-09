'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Select,
  toast,
} from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'CARD', label: 'Thẻ (POS/ATM)' },
  { value: 'QR_VIETQR', label: 'VietQR' },
]

export function RecordPaymentDialog({
  bookingId,
  bookingCode,
  remainingAmount,
  isOpen,
  onClose,
  onDone,
}: {
  bookingId: string
  bookingCode: string
  remainingAmount: number
  isOpen: boolean
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations('dash.bookings')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()

  const [amount, setAmount] = React.useState<string>('')
  const [method, setMethod] = React.useState<'CASH' | 'BANK_TRANSFER' | 'CARD' | 'QR_VIETQR'>('CASH')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!isOpen) return
    setAmount(remainingAmount > 0 ? String(remainingAmount) : '')
    setMethod('CASH')
    setError('')
    setBusy(false)
  }, [isOpen, remainingAmount])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError('Vui lòng nhập số tiền hợp lệ (> 0 đ)')
      return
    }

    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          amount: Math.round(numericAmount),
          method,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Đã ghi nhận thanh toán ${labels.money(numericAmount)} thành công`)
        onDone()
        onClose()
      } else {
        setError(apiError(data.error) || 'Ghi nhận thanh toán thất bại')
      }
    } catch {
      setError(t('actions.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => !busy && onClose()} size="sm">
      <form onSubmit={submit}>
        <ModalHeader onClose={() => !busy && onClose()}>
          <span className="font-semibold">Ghi nhận thanh toán · {bookingCode}</span>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {remainingAmount > 0 && (
              <div className="rounded-box bg-warn-soft border border-warn/30 p-3 flex items-center justify-between text-small">
                <span className="text-muted">Còn phải thu:</span>
                <button
                  type="button"
                  onClick={() => setAmount(String(remainingAmount))}
                  className="font-semibold text-warn hover:underline"
                  title="Bấm để điền số tiền này"
                >
                  {labels.money(remainingAmount)}
                </button>
              </div>
            )}

            <div>
              <label className="block text-small font-medium text-fg mb-1">
                Phương thức thanh toán <span className="text-err">*</span>
              </label>
              <Select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                disabled={busy}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-small font-medium text-fg mb-1">
                Số tiền thanh toán (VNĐ) <span className="text-err">*</span>
              </label>
              <NumberInput
                value={amount}
                onValueChange={(val) => setAmount(val)}
                placeholder="Nhập số tiền..."
                disabled={busy}
                required
              />
            </div>

            {error && <p className="text-small text-err">{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" isLoading={busy} disabled={!amount || Number(amount) <= 0}>
            Xác nhận thu tiền
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
