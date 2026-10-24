'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Textarea } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'
import type { RefundSuggestion } from '@/lib/bookings/cancel-refund'

interface Preview extends RefundSuggestion {
  status: string
  payments: { amount: number; method: string; paidAt: string | null }[]
  policyText: string | null
}

type Decision = 'suggested' | 'custom' | 'none'

/**
 * Cancelling a booking with the refund the hotel's policy suggests
 * (GET /api/bookings/[id]/cancel): staff refund it, another amount, or
 * nothing; differing from the suggestion needs a reason, which is logged.
 * Used by the booking panel/page and the calendar.
 */
export function CancelDialog({
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
  /** after a successful cancellation, with the message to show */
  onDone: (message: string) => void
}) {
  const t = useTranslations('dash.bookings')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [decision, setDecision] = React.useState<Decision>('suggested')
  const [amount, setAmount] = React.useState('')
  const [refundReason, setRefundReason] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen) return
    setPreview(null)
    setDecision('suggested')
    setAmount('')
    setRefundReason('')
    setReason('')
    setError('')
    let alive = true
    fetch(`/api/bookings/${bookingId}/cancel`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d.success) setPreview(d.data)
        else setError(apiError(d.error) || t('cancelDialog.previewError'))
      })
      .catch(() => alive && setError(t('actions.noConnection')))
    return () => {
      alive = false
    }
  }, [isOpen, bookingId, t])

  const paid = (preview?.totalPaid ?? 0) > 0
  const refundAmount =
    !preview ? 0 : decision === 'suggested' ? preview.suggested : decision === 'none' ? 0 : Math.round(Number(amount) || 0)
  const needsReason = paid && !!preview && refundAmount !== preview.suggested

  const submit = async () => {
    if (!preview) return
    if (paid && decision === 'custom' && (amount === '' || !(Number(amount) >= 0))) {
      setError(t('cancelDialog.amountRequired'))
      return
    }
    if (refundAmount > preview.totalPaid) {
      setError(t('cancelDialog.amountTooHigh', { paid: labels.money(preview.totalPaid) }))
      return
    }
    if (needsReason && refundReason.trim().length < 3) {
      setError(t('cancelDialog.refundReasonRequired'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(reason.trim() && { reason: reason.trim() }),
          ...(paid && {
            refund: {
              decision,
              ...(decision === 'custom' && { amount: refundAmount }),
              ...(needsReason && { reason: refundReason.trim() }),
            },
          }),
        }),
      })
      const data = await res.json()
      if (data.success) {
        onDone(
          data.refundInfo?.refundAmount
            ? t('cancelDialog.cancelledRefund', { amount: labels.money(data.refundInfo.refundAmount) })
            : t('cancelDialog.cancelled')
        )
      } else {
        setError(apiError(data.error) || t('actions.failed'))
      }
    } catch {
      setError(t('actions.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  const option = (value: Decision, label: string) => (
    <label className="flex items-center gap-2 text-small text-fg">
      <input type="radio" name="refund" checked={decision === value} onChange={() => setDecision(value)} className="w-4 h-4" />
      {label}
    </label>
  )

  const ruleText = (p: Preview) =>
    p.rule === 'free'
      ? t('cancelDialog.ruleFree', { hours: p.freeHours ?? 0, before: p.hoursBefore })
      : p.rule === 'late'
        ? p.freeHours === null
          ? t('cancelDialog.ruleNoFree', { percent: p.percent })
          : t('cancelDialog.ruleLate', { hours: p.freeHours, before: Math.max(0, p.hoursBefore), percent: p.percent })
        : t('cancelDialog.ruleCheckedIn')

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader onClose={onClose}>
        <span className="font-semibold">{t('cancelDialog.title', { code: bookingCode })}</span>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <p className="text-small text-muted">{t('cancelDialog.irreversible')}</p>
          {!preview && !error && <p className="text-small text-muted">{t('cancelDialog.calculating')}</p>}
          {preview && !paid && <p className="text-small text-fg">{t('cancelDialog.nothingPaid')}</p>}
          {preview && paid && (
            <div className="space-y-3">
              <div className="rounded-ctl bg-warn-soft px-3 py-2 text-small text-fg space-y-1">
                <p>{t.rich('cancelDialog.paid', { amount: labels.money(preview.totalPaid), strong: (c) => <strong>{c}</strong> })}</p>
                <p>{ruleText(preview)}</p>
                <p>{t.rich('cancelDialog.suggested', { amount: labels.money(preview.suggested), strong: (c) => <strong>{c}</strong> })}</p>
              </div>
              {preview.policyText && (
                <details className="text-small text-muted">
                  <summary className="cursor-pointer">{t('cancelDialog.policyText')}</summary>
                  <p className="mt-1 whitespace-pre-line">{preview.policyText}</p>
                </details>
              )}
              <div className="space-y-2" role="radiogroup" aria-label={t('cancelDialog.refundGroup')}>
                {option('suggested', t('cancelDialog.refundSuggested', { amount: labels.money(preview.suggested) }))}
                {option('custom', t('cancelDialog.refundCustom'))}
                {decision === 'custom' && (
                  <Input
                    type="number"
                    min={0}
                    max={preview.totalPaid}
                    step={1000}
                    label={t('cancelDialog.amount')}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                )}
                {preview.suggested > 0 && option('none', t('cancelDialog.refundNone'))}
              </div>
              {needsReason && (
                <Textarea label={t('cancelDialog.refundReason')} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={2} />
              )}
              <p className="text-xs text-muted">{t('cancelDialog.howRefund')}</p>
            </div>
          )}
          <Input label={t('cancelDialog.reason')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('cancelDialog.reasonPlaceholder')} />
          {error && <p className="text-small text-err">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {tc('actions.close')}
        </Button>
        <Button variant="danger" isLoading={busy} disabled={!preview} onClick={submit}>
          {paid && refundAmount > 0 ? t('cancelDialog.submitRefund', { amount: labels.money(refundAmount) }) : t('actions.cancelBooking')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
