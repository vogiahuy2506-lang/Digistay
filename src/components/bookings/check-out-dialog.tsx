'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Textarea, NumberInput } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'

interface Preview {
  hoursLate: number
  percent: number
  suggestedFee: number
  checkOutTime: string
  /** owed before the late fee */
  due?: number
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
  const t = useTranslations('dash.bookings')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [decision, setDecision] = React.useState<Decision>('apply')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [payAction, setPayAction] = React.useState<'collect' | 'debt'>('collect')
  const [payMethod, setPayMethod] = React.useState<'CASH' | 'BANK_TRANSFER' | 'CARD' | 'QR_VIETQR'>('CASH')
  const [debtReason, setDebtReason] = React.useState('')

  React.useEffect(() => {
    if (!isOpen) return
    setPreview(null)
    setDecision('apply')
    setAmount('')
    setReason('')
    setPayAction('collect')
    setPayMethod('CASH')
    setDebtReason('')
    setError('')
    let alive = true
    fetch(`/api/bookings/${bookingId}/check-out`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d.success) setPreview(d.data)
        else setError(apiError(d.error) || t('checkOut.previewError'))
      })
      .catch(() => alive && setError(t('actions.noConnection')))
    return () => {
      alive = false
    }
  }, [isOpen, bookingId, t])

  const late = (preview?.suggestedFee ?? 0) > 0
  const needsReason = late && decision !== 'apply'
  // What the guest still owes with the fee as decided: the desk collects it (it used to go unmentioned).
  const fee = !late ? 0 : decision === 'apply' ? preview!.suggestedFee : decision === 'edit' ? Math.max(0, Math.round(Number(amount) || 0)) : 0
  const toCollect = (preview?.due ?? 0) + fee

  const submit = async () => {
    if (needsReason && reason.trim().length < 3) {
      setError(t('checkOut.reasonRequired'))
      return
    }
    if (late && decision === 'edit' && !(Number(amount) >= 0 && amount !== '')) {
      setError(t('checkOut.amountRequired'))
      return
    }
    if (toCollect > 0 && payAction === 'debt' && debtReason.trim().length < 3) {
      setError('Vui lòng ghi rõ lý do công nợ khi trả phòng còn nợ tiền')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload: Record<string, any> = {}
      if (late) {
        payload.lateFee = {
          decision,
          ...(decision === 'edit' && { amount: Math.round(Number(amount)) }),
          ...(decision !== 'apply' && { reason: reason.trim() }),
        }
      }
      if (toCollect > 0) {
        payload.payment = {
          action: payAction,
          ...(payAction === 'collect' && { method: payMethod, amount: toCollect }),
          ...(payAction === 'debt' && { debtReason: debtReason.trim() }),
        }
      }
      const res = await fetch(`/api/bookings/${bookingId}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) onDone(apiError(data.message) || t('checkOut.done'))
      else setError(apiError(data.error) || t('actions.failed'))
    } catch {
      setError(t('actions.noConnection'))
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
        <span className="font-semibold">{t('checkOut.title', { code: bookingCode })}</span>
      </ModalHeader>
      <ModalBody>
        {!preview && !error && <p className="text-small text-muted">{t('checkOut.calculating')}</p>}
        {preview && !late && (
          <p className="text-small text-fg">{t('checkOut.onTime', { time: preview.checkOutTime })}</p>
        )}
        {preview && late && (
          <div className="space-y-3">
            <p className="text-small text-fg rounded-ctl bg-warn-soft px-3 py-2">
              {t.rich('checkOut.late', {
                hours: preview.hoursLate,
                time: preview.checkOutTime,
                percent: preview.percent,
                fee: labels.money(preview.suggestedFee),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <div className="space-y-2" role="radiogroup" aria-label={t('checkOut.feeGroup')}>
              {option('apply', t('checkOut.apply', { fee: labels.money(preview.suggestedFee) }))}
              {option('edit', t('checkOut.edit'))}
              {decision === 'edit' && (
                <NumberInput
                  label={t('checkOut.amount')}
                  value={amount}
                  onValueChange={(v) => setAmount(v)}
                />
              )}
              {option('waive', t('checkOut.waive'))}
            </div>
            {needsReason && (
              <Textarea label={t('checkOut.reason')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            )}
          </div>
        )}
        {preview && toCollect > 0 && (
          <div className="mt-4 pt-3 border-t border-line space-y-3">
            <div className="flex justify-between items-center bg-fg/[0.04] p-3 rounded-xl border border-line">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Số tiền cần thu:</span>
              <span className="text-base font-bold text-fg tabular-nums">{labels.money(toCollect)}</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-fg block">Xử lý thanh toán khi trả phòng:</label>
              
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-line bg-panel hover:bg-fg/[0.02] cursor-pointer">
                  <input
                    type="radio"
                    name="pay-action"
                    checked={payAction === 'collect'}
                    onChange={() => setPayAction('collect')}
                    className="mt-0.5 text-acc focus:ring-acc"
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-fg block">Thu tiền ngay (Ghi nhận Sổ quỹ & Doanh thu)</span>
                    <span className="text-muted block mt-0.5">Tạo phiếu thu {labels.money(toCollect)} và ghi nhận đơn đã thanh toán đủ</span>
                  </div>
                </label>

                {payAction === 'collect' && (
                  <div className="pl-6 pt-1 space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted block">Hình thức thu tiền *</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as any)}
                      className="w-full h-9 px-2.5 text-xs rounded-ctl border border-line bg-raised text-fg focus:outline-none focus:ring-2 focus:ring-acc"
                    >
                      <option value="CASH">Tiền mặt tại quầy</option>
                      <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                      <option value="CARD">Quẹt thẻ ngân hàng (POS)</option>
                      <option value="QR_VIETQR">Quét mã VietQR</option>
                    </select>
                  </div>
                )}

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-line bg-panel hover:bg-fg/[0.02] cursor-pointer">
                  <input
                    type="radio"
                    name="pay-action"
                    checked={payAction === 'debt'}
                    onChange={() => setPayAction('debt')}
                    className="mt-0.5 text-warn focus:ring-warn"
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-warn block">Cho nợ / Trả phòng chưa thu hết tiền</span>
                    <span className="text-muted block mt-0.5">Chưa ghi nhận tiền, bắt buộc phải nhập lý do công nợ bên dưới</span>
                  </div>
                </label>

                {payAction === 'debt' && (
                  <div className="pl-6 pt-1 space-y-1">
                    <Textarea
                      label="Lý do cho nợ / Ghi chú công nợ *"
                      value={debtReason}
                      onChange={(e) => setDebtReason(e.target.value)}
                      placeholder="Ví dụ: Khách quen anh Hùng hẹn chuyển khoản tối nay..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-small text-err">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {tc('actions.close')}
        </Button>
        <Button isLoading={busy} disabled={!preview} onClick={submit}>
          {t('checkOut.submit')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
