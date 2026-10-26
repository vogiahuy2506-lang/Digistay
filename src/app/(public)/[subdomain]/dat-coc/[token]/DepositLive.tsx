'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { formatVnd } from '@/lib/bookings/display'
import type { DepositState } from '@/lib/payments/deposit-view'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'
import { SiteLink, useSiteHref } from '../../_components/site-base'
import { SaveQrButton } from './SaveQrButton'

const POLL_MS = 4000
/** A manual transfer waits for staff, not a webhook: no need to ask as often. */
const POLL_MANUAL_MS = 10_000
/** How much longer the room is held after "Tôi đã chuyển khoản" (manual-deposit.ts, CLAIM_EXTENSION_MINUTES). */
const CLAIM_EXTENSION_MINUTES = 30

function CopyButton({ value }: { value: string }) {
  const t = useTranslations('site.booking.common')
  const [done, setDone] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => setDone(true), () => {})}
      className="h-9 flex-none border border-line bg-panel px-3.5 text-[13px] font-medium text-fg hover:border-ink"
    >
      {done ? t('copied') : t('copy')}
    </button>
  )
}

/**
 * The live part of the deposit page (Claude Design "Digistay Dat Coc
 * PayOS"): countdown, the QR and transfer details, and a poll of
 * GET /api/public/deposits/[token] that moves on once PayOS reports the
 * money. "Tạo mã mới" asks POST for a new PayOS link, then re-reads the page.
 *
 * A manual transfer (src/lib/payments/manual-deposit.ts) shows the hotel's
 * own VietQR and account instead, and "Tôi đã chuyển khoản", which tells the
 * hotel (POST …/claim) and holds the room a little longer; the page moves on
 * once staff confirm the money.
 */
export function DepositLive({
  token,
  state,
  mode,
  claimedAt,
  bookingCode,
  amount,
  qrImage,
  checkoutUrl,
  expiresAt,
  deadline,
  transfer,
  hotel,
  hadDeposit,
}: {
  token: string
  state: DepositState
  mode: 'payos' | 'manual'
  /** manual: when the guest said they transferred */
  claimedAt: string | null
  bookingCode: string
  amount: number
  qrImage: string | null
  checkoutUrl: string | null
  expiresAt: string | null
  deadline: string | null
  transfer: { accountNumber: string | null; accountName: string | null; note: string; bankName?: string | null; wallet?: boolean } | null
  hotel: { name: string; phone: string | null }
  /** false: a booking without an online deposit (cancelled by the hotel) */
  hadDeposit: boolean
}) {
  const t = useTranslations('site.booking.deposit')
  const locale = useLocale()
  const lang = locale === 'en' ? 'en' : 'vi'
  const router = useRouter()
  const href = useSiteHref()
  const [now, setNow] = React.useState<number | null>(null)
  const [making, setMaking] = React.useState(false)
  const [makeFailed, setMakeFailed] = React.useState(false)
  const [claiming, setClaiming] = React.useState(false)
  const [claimError, setClaimError] = React.useState<string | null>(null)
  const manual = mode === 'manual'
  const done = React.useCallback(() => router.replace(href(`/xac-nhan/${token}`)), [router, href, token])

  // Paid, or nothing to pay online: the confirmation is the next page.
  React.useEffect(() => {
    if (state === 'paid' || state === 'none') done()
  }, [state, done])

  const ends = expiresAt ? Date.parse(expiresAt) : null
  React.useEffect(() => {
    setNow(Date.now())
    if (state !== 'pending') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [state])
  const left = ends && now !== null ? Math.max(0, Math.round((ends - now) / 1000)) : null

  // Out of time: the server decides what comes next (a new code, or cancelled).
  React.useEffect(() => {
    if (state === 'pending' && left === 0) router.refresh()
  }, [state, left, router])

  React.useEffect(() => {
    if (state !== 'pending') return
    let live = true
    const id = setInterval(async () => {
      const res = await fetch(`/api/public/deposits/${encodeURIComponent(token)}`, { cache: 'no-store' }).catch(() => null)
      const data = res?.ok ? await res.json().catch(() => null) : null
      const next: DepositState | undefined = data?.data?.state
      if (!live || !next || next === 'pending') return
      if (next === 'paid') done()
      else router.refresh()
    }, manual ? POLL_MANUAL_MS : POLL_MS)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [state, token, done, router, manual])

  const claim = async () => {
    setClaiming(true)
    setClaimError(null)
    try {
      const res = await fetch(`/api/public/deposits/${encodeURIComponent(token)}/claim`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) return router.refresh()
      setClaimError(res.status === 429 ? t('claimTooMany') : apiError(data.error) || t('claimFailed'))
    } catch {
      setClaimError(t('claimFailed'))
    } finally {
      setClaiming(false)
    }
  }

  const makeNew = async () => {
    setMaking(true)
    setMakeFailed(false)
    try {
      const res = await fetch(`/api/public/deposits/${encodeURIComponent(token)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (data.success && data.data?.paid) return done()
      if (data.success) return router.refresh()
      setMakeFailed(true)
    } catch {
      setMakeFailed(true)
    } finally {
      setMaking(false)
    }
  }

  const money = formatVnd(amount, lang)
  // "15:12 · 21/10/2026" in Vietnam time, by hand: Node's and the browser's ICU differ, and this renders on both.
  const at = (iso: string) => {
    const d = new Date(Date.parse(iso) + 7 * 60 * 60 * 1000)
    const two = (n: number) => String(n).padStart(2, '0')
    return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())} · ${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
  }
  const call = hotel.phone && (
    <a href={`tel:${hotel.phone.replace(/\s/g, '')}`} className="flex h-[48px] items-center justify-center border border-ink px-5 text-[14px] font-medium text-fg">
      {t('help', { phone: hotel.phone })}
    </a>
  )

  if (state === 'pending') {
    const rows = [
      // A manual transfer: every detail can be copied, the bank's name too (typed into a banking app).
      manual && transfer?.bankName && { label: transfer.wallet ? t('wallet') : t('bank'), value: transfer.bankName, copy: transfer.bankName },
      transfer?.accountNumber && {
        label: manual && transfer.wallet ? t('walletPhone') : t('account'),
        value: transfer.accountNumber,
        copy: transfer.accountNumber,
      },
      transfer?.accountName && { label: t('accountName'), value: transfer.accountName, ...(manual && { copy: transfer.accountName }) },
      { label: t('sum'), value: money, copy: String(Math.round(amount)) },
      transfer && { label: t('content'), value: transfer.note, copy: transfer.note },
    ].filter(Boolean) as { label: string; value: string; copy?: string }[]
    const claimedTime = claimedAt ? at(claimedAt).split(' · ')[0] : null
    return (
      <div>
        <div className="border border-line bg-panel">
          <div className="flex flex-col gap-4 border-b-2 border-acc px-6 py-6 sm:flex-row sm:items-end sm:justify-between lg:px-8">
            <div>
              <p className="text-label uppercase text-muted">{t('amount')}</p>
              <p className="mt-2 text-[36px] font-semibold leading-none tracking-[-0.02em] tabular-nums lg:text-[44px]">{money}</p>
            </div>
            {left !== null && (
              <div className="sm:text-right">
                <p className="text-label uppercase text-muted">{t('timeLeft')}</p>
                <p className="mt-2 font-mono text-[30px] font-medium tabular-nums lg:text-[34px]" aria-live="off">
                  {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
                </p>
                {expiresAt && <p className="mt-1 text-[12.5px] text-muted">{t('deadline', { time: at(deadline ?? expiresAt) })}</p>}
              </div>
            )}
          </div>
          <div className="grid gap-8 px-4 py-6 sm:px-6 sm:py-7 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:px-8">
            <div>
              {qrImage && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL made on the server */}
                  <img src={qrImage} alt={manual ? t('qrAltManual') : t('qrAlt')} className="aspect-square w-full max-w-[280px] border border-line bg-white p-2" />
                  <div className="mt-3">
                    <SaveQrButton image={qrImage} fileName={`${lang === 'en' ? 'deposit' : 'dat-coc'}-${bookingCode}.png`} />
                  </div>
                </>
              )}
              <p className="mt-3 text-[13px] leading-[1.55] text-muted">{manual ? t('qrHintManual') : t('qrHint')}</p>
            </div>
            <div>
              <dl className="border-t border-line">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center gap-3 border-b border-line py-3 sm:gap-4">
                    <dt className="w-[88px] flex-none text-[13px] text-muted sm:w-[110px] sm:text-[13.5px]">{r.label}</dt>
                    <dd className="min-w-0 flex-1 break-words text-[15px] font-medium tabular-nums text-fg">{r.value}</dd>
                    {r.copy && <CopyButton value={r.copy} />}
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[13px] leading-[1.6] text-fg/80">{manual ? t('exactManual', { hotel: hotel.name }) : t('exact', { hotel: hotel.name })}</p>
            </div>
          </div>
          {!manual ? (
            <p className="flex items-start gap-3 bg-plain-soft/70 px-6 py-4 text-[14px] leading-[1.55] lg:px-8" role="status">
              <span aria-hidden className="mt-1.5 h-2 w-2 flex-none animate-pulse rounded-full bg-acc" />
              <span>
                <b className="font-semibold">{t('waiting')}</b> {t('waitingText')}
              </span>
            </p>
          ) : claimedTime ? (
            <p className="flex items-start gap-3 bg-ok-soft px-6 py-4 text-[14px] leading-[1.55] text-fg lg:px-8" role="status">
              <span aria-hidden className="mt-1.5 h-2 w-2 flex-none animate-pulse rounded-full bg-ok" />
              <span>
                <b className="font-semibold">{t('claimedTitle', { time: claimedTime })}</b> {t('claimedText', { hotel: hotel.name })}
              </span>
            </p>
          ) : (
            <div className="flex flex-col gap-3 bg-plain-soft/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
              <p className="max-w-[440px] text-[14px] leading-[1.55] text-fg">
                {ends ? t('claimTextHold', { hotel: hotel.name, minutes: CLAIM_EXTENSION_MINUTES }) : t('claimText', { hotel: hotel.name })}
              </p>
              <button
                type="button"
                onClick={claim}
                disabled={claiming}
                className="flex h-[48px] flex-none items-center justify-center bg-ink px-6 text-[14px] font-medium text-on-ink disabled:bg-muted"
              >
                {claiming ? t('claiming') : t('claim')}
              </button>
            </div>
          )}
          {claimError && (
            <p role="alert" className="border-t border-line px-6 py-3 text-[14px] font-medium text-err lg:px-8">
              ⚠ {claimError}
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-[14px] font-medium">
          {checkoutUrl && (
            <a href={checkoutUrl} className="text-acc hover:underline">
              {t('openPayos')}
            </a>
          )}
          {hotel.phone && (
            <a href={`tel:${hotel.phone.replace(/\s/g, '')}`} className="text-acc hover:underline">
              {t('help', { phone: hotel.phone })}
            </a>
          )}
        </div>
      </div>
    )
  }

  const panel = (tone: 'warn' | 'err' | 'plain', text: string, actions: React.ReactNode) => (
    <div className={cn('border px-6 py-6 lg:px-8', tone === 'warn' ? 'border-warn/30 bg-warn-soft' : tone === 'err' ? 'border-err/25 bg-err-soft' : 'border-line bg-panel')}>
      <p className="max-w-[560px] text-[15px] leading-[1.65] text-fg">{text}</p>
      {makeFailed && <p className="mt-3 text-[14px] font-medium text-err">⚠ {t('makeFailed')}</p>}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">{actions}</div>
    </div>
  )
  const primary = 'flex h-[48px] items-center justify-center bg-ink px-6 text-[14px] font-medium text-on-ink disabled:bg-muted'

  if (state === 'expired')
    return panel(
      'warn',
      deadline ? t('expiredText', { time: at(deadline) }) : t('expiredTextNoDeadline'),
      <>
        <button type="button" onClick={makeNew} disabled={making} className={primary}>
          {making ? t('making') : t('newCode')}
        </button>
        {call}
      </>,
    )
  if (state === 'error')
    return panel(
      'err',
      t('errorText'),
      <>
        <button type="button" onClick={makeNew} disabled={making} className={primary}>
          {making ? t('making') : t('retry')}
        </button>
        {call}
      </>,
    )
  if (state === 'cancelled')
    return panel(
      'plain',
      hadDeposit ? t('cancelledText') : t('cancelledByHotel'),
      <>
        <SiteLink path="/search" className={primary}>
          {t('bookAgain')}
        </SiteLink>
        {call}
      </>,
    )
  return panel(
    'plain',
    '',
    <SiteLink path={`/xac-nhan/${token}`} className={primary}>
      {t('toConfirmation')}
    </SiteLink>,
  )
}
