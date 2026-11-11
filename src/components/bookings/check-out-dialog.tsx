'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, Banknote, Check, Copy, QrCode } from 'lucide-react'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, Textarea, NumberInput } from '@/components/ui'
import { VietQR } from '@/components/ui/viet-qr'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'

interface Preview {
  status: string
  bookingCode?: string
  hoursLate: number
  percent: number
  suggestedFee: number
  checkOutTime: string
  /** owed before the late fee */
  due?: number
  bankAccount?: {
    bankCode: string
    bankName: string
    accountNumber: string
    accountHolder: string
  } | null
}

type Decision = 'apply' | 'edit' | 'waive'

/**
 * Check-out with the late fee the hotel's policy suggests
 * (GET /api/bookings/[id]/check-out): the front desk applies it, charges
 * another amount or waives it; those two need a reason, which is logged.
 * When payment is due, supports 2 clear options: Cash (Tiền mặt) or
 * Bank Transfer (Chuyển khoản VietQR with live QR for guests to scan).
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
  const [payMethod, setPayMethod] = React.useState<'CASH' | 'BANK_TRANSFER'>('CASH')
  const [debtReason, setDebtReason] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  React.useEffect(() => {
    if (!isOpen) return
    setPreview(null)
    setDecision('apply')
    setAmount('')
    setReason('')
    setPayAction('collect')
    setPayMethod('CASH')
    setDebtReason('')
    setCopied(false)
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

  const submitLabel = () => {
    if (!toCollect || toCollect <= 0) return t('checkOut.submit')
    if (payAction === 'debt') return 'Ghi nhận nợ & Trả phòng'
    if (payMethod === 'BANK_TRANSFER') return 'Đã nhận chuyển khoản & Trả phòng'
    return 'Thu tiền mặt & Trả phòng'
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
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
          <div className="mt-4 pt-3 border-t border-line space-y-3.5">
            <div className="flex justify-between items-center bg-fg/[0.04] p-3 rounded-xl border border-line">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Số tiền cần thanh toán:</span>
              <span className="text-lg font-bold text-primary tabular-nums">{labels.money(toCollect)}</span>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-fg block">Xử lý thanh toán khi trả phòng:</label>

              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-line bg-panel hover:bg-fg/[0.02] cursor-pointer">
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
                  <div className="pl-6 pt-1 space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                      Hình thức thu tiền *
                    </label>

                    {/* 2 lựa chọn duy nhất: Tiền mặt hoặc Chuyển khoản */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPayMethod('CASH')}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                          payMethod === 'CASH'
                            ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary/30'
                            : 'border-line bg-panel text-muted hover:text-fg hover:bg-fg/5'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                            payMethod === 'CASH' ? 'bg-primary text-white' : 'bg-fg/5 text-muted'
                          )}
                        >
                          <Banknote className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-fg">Tiền mặt</span>
                          <span className="block text-[10px] text-muted truncate">Thu tại quầy lễ tân</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPayMethod('BANK_TRANSFER')}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                          payMethod === 'BANK_TRANSFER'
                            ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary/30'
                            : 'border-line bg-panel text-muted hover:text-fg hover:bg-fg/5'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                            payMethod === 'BANK_TRANSFER' ? 'bg-primary text-white' : 'bg-fg/5 text-muted'
                          )}
                        >
                          <QrCode className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-fg">Chuyển khoản</span>
                          <span className="block text-[10px] text-muted truncate">Quét mã VietQR</span>
                        </div>
                      </button>
                    </div>

                    {/* Khi chọn Tiền mặt */}
                    {payMethod === 'CASH' && (
                      <div className="rounded-xl border border-line bg-fg/[0.02] p-3 text-xs text-muted flex items-center justify-between">
                        <span>Số tiền mặt nhân viên thu trực tiếp:</span>
                        <span className="font-bold text-sm text-fg tabular-nums">{labels.money(toCollect)}</span>
                      </div>
                    )}

                    {/* Khi chọn Chuyển khoản: Hiển thị mã VietQR trực tiếp cho khách quét */}
                    {payMethod === 'BANK_TRANSFER' && (
                      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-line/60">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                            <QrCode className="h-4 w-4" />
                            <span>MÃ VIETQR THANH TOÁN TRẢ PHÒNG</span>
                          </div>
                          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded tabular-nums">
                            {labels.money(toCollect)}
                          </span>
                        </div>

                        {preview.bankAccount ? (
                          <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                            {/* Mã QR cho khách quét */}
                            <div className="shrink-0 bg-white p-2.5 rounded-xl border border-line shadow-xs text-center">
                              <VietQR
                                bankCode={preview.bankAccount.bankCode}
                                accountNumber={preview.bankAccount.accountNumber}
                                accountHolder={preview.bankAccount.accountHolder}
                                amount={toCollect}
                                description={`DS${bookingCode}`}
                                size={160}
                              />
                              <p className="mt-1.5 text-[10px] font-medium text-slate-500">
                                Quét bằng app ngân hàng
                              </p>
                            </div>

                            {/* Thông tin tài khoản & nội dung */}
                            <div className="flex-1 min-w-0 space-y-2 text-xs">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-muted block">Ngân hàng:</span>
                                <span className="font-semibold text-fg block">
                                  {preview.bankAccount.bankName} ({preview.bankAccount.bankCode})
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase font-bold text-muted block">Số tài khoản:</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono font-bold text-sm text-primary tabular-nums">
                                    {preview.bankAccount.accountNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyText(preview.bankAccount!.accountNumber)}
                                    className="p-1 rounded hover:bg-fg/10 text-muted hover:text-fg transition-colors"
                                    title="Sao chép số tài khoản"
                                  >
                                    {copied ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase font-bold text-muted block">Chủ tài khoản:</span>
                                <span className="font-semibold text-fg uppercase block">
                                  {preview.bankAccount.accountHolder}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase font-bold text-muted block">Nội dung chuyển:</span>
                                <span className="font-mono font-bold text-fg bg-fg/5 px-2 py-0.5 rounded text-[11px] inline-block mt-0.5">
                                  DS{bookingCode}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-xs text-warn flex items-start gap-2.5">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Cơ sở chưa cài đặt tài khoản ngân hàng nhận tiền</p>
                              <p className="mt-0.5 text-[11px] text-muted">
                                Vui lòng cấu hình tài khoản trong mục <strong>Tài khoản ngân hàng</strong> của cơ sở để tạo mã VietQR tự động, hoặc chọn thu tiền mặt tại quầy.
                              </p>
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] text-muted italic pt-1 border-t border-line/60">
                          * Hướng dẫn: Đưa mã QR trên cho khách quét thanh toán. Sau khi kiểm tra tiền đã vào tài khoản, bấm nút &quot;Đã nhận chuyển khoản & Trả phòng&quot;.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-line bg-panel hover:bg-fg/[0.02] cursor-pointer">
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
          {submitLabel()}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
