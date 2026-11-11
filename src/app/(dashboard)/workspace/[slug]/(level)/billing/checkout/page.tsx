'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Alert, AlertDescription, Badge, Button, Loading } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { formatVnd } from '@/lib/bookings/display'
import { apiError } from '@/lib/i18n/api-errors'
import { isPlanId, type Plan, type PlanId } from '@/lib/marketing/plans'
import type { PaymentView } from '@/lib/billing/view'
import { InvoiceForm, buyerPayload, buyerValid, initialBuyer, type BuyerDraft } from '../invoice-form'
import { planName, vnDate, type Billing, type BillingData, type LimitKey } from '../types'
import { NoAccess } from '@/components/payment/no-access'
import { useCan } from '@/components/layout/workspace-context'
import { cn } from '@/lib/utils'

const POLL_MS = 3000
const LIMITS: LimitKey[] = ['properties', 'rooms', 'staff']

export default function DedicatedCheckoutPage() {
  const t = useTranslations('dash.billing')
  const locale = useLocale() === 'en' ? 'en' : 'vi'
  const search = useSearchParams()
  const router = useRouter()
  const { workspace, loading: wsLoading } = useWorkspace()
  const allowed = useCan('billing_manage')
  const workspaceId = workspace?.id
  const slug = workspace?.slug

  // URL query params
  const planQuery = search.get('plan') ?? ''
  const initialPlan = planQuery || 'growth'
  const initialBilling: Billing = search.get('billing') === 'YEAR' ? 'YEAR' : 'MONTH'

  const [data, setData] = React.useState<BillingData | null>(null)
  const [error, setError] = React.useState('')
  const [selectedPlan, setSelectedPlan] = React.useState<string>(initialPlan)
  const [selectedBilling, setSelectedBilling] = React.useState<Billing>(initialBilling)

  // Payment & Buyer states
  const [payment, setPayment] = React.useState<PaymentView | null>(null)
  const [buyer, setBuyer] = React.useState<BuyerDraft>(() => initialBuyer(null))
  const [showErrors, setShowErrors] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)
  const [now, setNow] = React.useState(() => Date.now())

  // Load subscription info
  const load = React.useCallback(async () => {
    if (!workspaceId) return
    const url = `/api/workspaces/${workspaceId}/subscription${initialPlan ? `?plan=${encodeURIComponent(initialPlan)}` : ''}`
    const res = await fetch(url, { cache: 'no-store' }).catch(() => null)
    const json = await res?.json().catch(() => null)
    if (!res?.ok || !json?.success) {
      setError(apiError(json?.error) || t('notReady'))
      return
    }
    const d = json.data as BillingData
    setData(d)
    if (d.einvoice?.lastBuyer) {
      setBuyer(initialBuyer(d.einvoice.lastBuyer))
    }
    if (d.pending) {
      setPayment(d.pending)
      setSelectedPlan(d.pending.plan)
      setSelectedBilling(d.pending.billing)
    }
  }, [workspaceId, initialPlan, t])

  React.useEffect(() => {
    load()
  }, [load])

  // Countdown timer
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Poll payment status while waiting
  const refreshPayment = React.useCallback(
    async (sync: boolean) => {
      if (!workspaceId || !payment) return
      const res = await fetch(`/api/workspaces/${workspaceId}/subscription/payments/${payment.id}${sync ? '?sync=1' : ''}`, { cache: 'no-store' }).catch(() => null)
      const json = await res?.json().catch(() => null)
      if (json?.success) {
        setPayment((p) => (p ? { ...json.data, qrImage: json.data.qrImage ?? p.qrImage } : null))
      }
    },
    [workspaceId, payment?.id] // eslint-disable-line react-hooks/exhaustive-deps
  )

  React.useEffect(() => {
    if (!payment || payment.status !== 'PENDING') return
    let count = 0
    const interval = setInterval(() => {
      count++
      refreshPayment(count % 4 === 0)
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [payment?.status, refreshPayment])

  // Create checkout payment request
  const createPayment = async (planToBuy = selectedPlan, billingToBuy = selectedBilling) => {
    if (!workspaceId || !data) return
    if (data.einvoice && !buyerValid(buyer)) {
      setShowErrors(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/subscription/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planToBuy,
          billing: billingToBuy,
          ...(data.einvoice && { invoice: buyerPayload(buyer) }),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(apiError(json?.error) || t('notReady'))
        return
      }
      setPayment(json.data)
    } catch {
      setError(t('notReady'))
    } finally {
      setBusy(false)
    }
  }

  // Auto-initiate checkout if not resuming existing payment
  React.useEffect(() => {
    if (data && !payment && data.checkoutReady) {
      createPayment(selectedPlan, selectedBilling)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  if (!allowed) return <NoAccess title={t('title')} inPage />
  if (wsLoading || (!data && !error)) return <Loading className="py-24" />
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Link href={`/workspace/${slug}/billing`} className="text-sm font-medium text-acc hover:underline">
            ← {t('title')}
          </Link>
        </div>
      </div>
    )
  }

  const currentPlan = data.plans.find((p) => p.id === selectedPlan) ?? data.plans[0]
  const amount = selectedBilling === 'YEAR' ? currentPlan.price * data.yearlyMonths : currentPlan.price
  const change = (data.changes as Record<string, any>)[selectedPlan]?.[selectedBilling]

  // Time remaining
  const left = payment?.expiresAt ? Math.max(0, new Date(payment.expiresAt).getTime() - now) : null
  const expired = Boolean(payment && payment.status !== 'PAID' && (payment.status !== 'PENDING' || left === 0))
  const mmss = left === null ? '' : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`

  // --- SUCCESS VIEW ---
  if (payment?.status === 'PAID') {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok-soft text-3xl text-ok" aria-hidden>
          ✓
        </div>
        <h1 className="mt-6 font-serif text-3xl font-medium text-fg">
          {t(`checkout.paid.${(payment.change ?? 'new') as 'new' | 'renew' | 'upgrade' | 'downgrade'}`, {
            plan: planName(payment.plan),
          })}
        </h1>
        <p className="mt-3 text-base text-muted">
          {payment.periodEnd ? t('checkout.paidLead', { date: vnDate(payment.periodEnd) }) : 'Gói dịch vụ đã sẵn sàng hoạt động.'}
        </p>
        <p className="mt-2 text-sm text-muted">
          Biên nhận thanh toán đã được gửi tới email của chủ workspace.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button onClick={() => router.push(`/workspace/${slug}`)}>
            Bắt đầu sử dụng ngay
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/workspace/${slug}/billing`)}>
            Xem lịch sử thanh toán
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl pb-20 pt-6">
      {/* Top back navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/workspace/${slug}/billing`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
        >
          ← {t('title')}
        </Link>
        <span className="text-xs uppercase tracking-wider text-muted font-medium">
          Digistay Secure Checkout
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* LEFT COLUMN: Order Details & Customization (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-box border border-line bg-panel p-6 sm:p-7">
            <h1 className="font-serif text-2xl font-semibold text-fg sm:text-3xl">
              Xác nhận đơn hàng & Thông tin gói
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Đăng ký gói dịch vụ cho Workspace: <strong className="text-fg">{data.workspace.name}</strong>
            </p>

            {/* Plan selector pills */}
            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Chọn gói phần mềm
              </label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {data.plans.map((p) => {
                  const active = p.id === selectedPlan
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlan(p.id)
                        createPayment(p.id, selectedBilling)
                      }}
                      className={cn(
                        'flex flex-col rounded-ctl border p-3.5 text-left transition-all',
                        active ? 'border-ink bg-fg/[0.04] shadow-sm' : 'border-line hover:border-muted'
                      )}
                    >
                      <span className="text-sm font-semibold text-fg">{planName(p.id)}</span>
                      <span className="mt-1 text-xs text-muted">
                        {p.properties} cơ sở · {p.rooms} phòng
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Billing cycle toggle */}
            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Chu kỳ thanh toán
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBilling('MONTH')
                    createPayment(selectedPlan, 'MONTH')
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-ctl border p-3.5 text-left transition-all',
                    selectedBilling === 'MONTH' ? 'border-ink bg-fg/[0.04] shadow-sm' : 'border-line hover:border-muted'
                  )}
                >
                  <span className="text-sm font-medium text-fg">Theo tháng</span>
                  <span className="text-xs text-muted">1 tháng</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBilling('YEAR')
                    createPayment(selectedPlan, 'YEAR')
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-ctl border p-3.5 text-left transition-all',
                    selectedBilling === 'YEAR' ? 'border-ink bg-fg/[0.04] shadow-sm' : 'border-line hover:border-muted'
                  )}
                >
                  <span className="text-sm font-medium text-fg">Theo năm</span>
                  <Badge variant="success" className="text-[11px]">
                    Tặng {12 - data.yearlyMonths} tháng
                  </Badge>
                </button>
              </div>
            </div>

            {/* Plan limits */}
            <div className="mt-6 border-t border-line/70 pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Quyền lợi đi kèm gói {planName(selectedPlan)}
              </h3>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-fg/80 sm:grid-cols-4">
                <li className="rounded bg-page p-2.5">
                  <div className="font-semibold text-fg">{currentPlan.properties}</div>
                  <div className="text-muted">Cơ sở</div>
                </li>
                <li className="rounded bg-page p-2.5">
                  <div className="font-semibold text-fg">{currentPlan.rooms}</div>
                  <div className="text-muted">Phòng tối đa</div>
                </li>
                <li className="rounded bg-page p-2.5">
                  <div className="font-semibold text-fg">{currentPlan.staff}</div>
                  <div className="text-muted">Tài khoản nhân viên</div>
                </li>
                <li className="rounded bg-page p-2.5">
                  <div className="font-semibold text-fg">Không giới hạn</div>
                  <div className="text-muted">Đặt phòng</div>
                </li>
              </ul>
            </div>
          </section>

          {/* E-Invoice Information (Mắt Bão HĐĐT) */}
          {data.einvoice && (
            <section className="rounded-box border border-line bg-panel p-6 sm:p-7">
              <h2 className="text-base font-semibold text-fg">
                Thông tin xuất hóa đơn điện tử (GTGT)
              </h2>
              <p className="mt-1 text-xs text-muted">
                Hóa đơn GTGT chính thức sẽ được phát hành tự động qua Mắt Bão và gửi vào email của bạn ngay sau khi thanh toán.
              </p>
              <div className="mt-5">
                <InvoiceForm
                  value={buyer}
                  onChange={setBuyer}
                  email={data.einvoice.email}
                  vat={data.einvoice.vat}
                  showErrors={showErrors}
                />
              </div>
            </section>
          )}

          {/* Security & Support Guarantee */}
          <div className="rounded-box border border-dashed border-line p-4 text-xs text-muted space-y-1.5">
            <p className="font-medium text-fg">
              ✓ Kích hoạt tức thì ngay khi tài khoản nhận được tiền
            </p>
            <p>
              Hệ thống xử lý thanh toán tự động 24/7 qua cổng VietQR PayOS. Nếu cần hỗ trợ khẩn cấp, vui lòng liên hệ hotline: <strong>0909 000 000</strong> hoặc email <strong>hotro@digistay.vn</strong>.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: VietQR Payment Box (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <section className="rounded-box border-2 border-ink bg-panel p-6 sm:p-7 shadow-md">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-muted font-medium">Tổng thanh toán</span>
                <div className="text-2xl font-bold tabular-nums text-fg">
                  {formatVnd(payment?.amount ?? amount, locale)}
                </div>
              </div>
              <Badge variant="gray">
                {selectedBilling === 'YEAR' ? 'Gói năm' : 'Gói tháng'}
              </Badge>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* QR Code Container */}
            <div className="mt-5 text-center">
              <div className="mx-auto max-w-[260px]">
                {payment?.qrImage && !expired ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={payment.qrImage}
                    alt={t('checkout.qrAlt')}
                    className="aspect-square w-full rounded-ctl border border-line bg-white p-3 shadow-sm"
                  />
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center rounded-ctl border-2 border-dashed border-line p-4 text-center">
                    <span className="text-sm font-medium text-muted">
                      {expired ? t('checkout.expired') : 'Đang khởi tạo mã VietQR…'}
                    </span>
                    {expired && (
                      <Button size="sm" className="mt-3" onClick={() => createPayment()}>
                        {t('checkout.newCode')}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {!expired && mmss && (
                <p className="mt-2.5 text-xs font-medium text-warn">
                  Mã thanh toán hết hạn sau: <span className="font-mono tabular-nums">{mmss}</span>
                </p>
              )}
            </div>

            {/* Bank details table */}
            <div className="mt-6 space-y-2.5 rounded-ctl bg-page p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted">Đơn vị nhận:</span>
                <span className="font-semibold text-fg">CÔNG TY CP DIGISO</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Số tiền:</span>
                <div className="flex items-center gap-1.5 font-bold text-fg">
                  <span>{formatVnd(payment?.amount ?? amount, locale)}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(String(payment?.amount ?? amount), 'amount')}
                    className="text-[11px] text-acc hover:underline"
                  >
                    {copiedKey === 'amount' ? '✓ Đã chép' : 'Sao chép'}
                  </button>
                </div>
              </div>
              {payment?.description && (
                <div className="flex items-center justify-between border-t border-line/50 pt-2">
                  <span className="text-muted">Nội dung CK:</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-fg">
                    <span className="rounded bg-fg/[0.08] px-1.5 py-0.5">{payment.description}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payment.description!, 'desc')}
                      className="text-[11px] font-sans text-acc hover:underline"
                    >
                      {copiedKey === 'desc' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Waiting status */}
            {!expired && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ok"></span>
                </span>
                <span>{t('checkout.waiting')}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 space-y-2">
              <Button
                className="w-full"
                isLoading={checking || busy}
                disabled={expired}
                onClick={async () => {
                  setChecking(true)
                  await refreshPayment(true)
                  setChecking(false)
                }}
              >
                {checking ? t('checkout.checking') : t('checkout.check')}
              </Button>

              {payment?.checkoutUrl && !expired && (
                <a
                  href={payment.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 w-full items-center justify-center rounded-ctl border border-line bg-panel text-xs font-medium text-fg hover:bg-fg/[0.03]"
                >
                  {t('checkout.openPayos')} ↗
                </a>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
