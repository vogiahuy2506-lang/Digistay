'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea } from '@/components/ui'
import { EnglishCopy } from '@/components/ui/english-copy'
import { toast } from '@/components/ui/toast'
import { useTranslations } from 'next-intl'
import { Save, ShieldCheck, Clock, Baby, Dog, Cigarette, FileText } from 'lucide-react'
import { DEFAULT_LATE_TIERS, type LateTier } from '@/lib/bookings/late-checkout'
import { apiError } from '@/lib/i18n/api-errors'

interface Policy {
  id: string
  propertyId: string
  checkInTime: string
  checkOutTime: string
  cancellationHours: number | null
  cancellationPolicy: string | null
  childrenAllowed: boolean
  minChildAge: number
  petsAllowed: boolean
  smokingAllowed: boolean
  additionalRules: string | null
  translations?: { en?: { cancellationPolicy?: string; additionalRules?: string } } | null
  onlineDepositPercent: number
  depositDeadlineMinutes: number
  /** null: the default tiers; []: no late fee */
  lateCheckoutTiers: LateTier[] | null
  /** read-only: the deposit needs a connected PayOS account */
  payosConnected?: boolean
}

const TIER_INPUT = 'h-10 px-3 border border-line rounded-ctl bg-raised text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc'

/** How long a guest has to pay the online deposit (Policy.depositDeadlineMinutes), in minutes; 0: never cancel. */
const DEADLINE_OPTIONS = [0, 30, 60, 120, 360, 720, 1440]

export default function PoliciesPage() {
  const t = useTranslations('dash.rooms.policies')
  const tc = useTranslations('dash.common')
  const deadlineLabel = (minutes: number) =>
    minutes === 0
      ? t('deposit.noAutoCancel')
      : minutes < 60
        ? t('deposit.minutes', { count: minutes })
        : t('deposit.hours', { count: minutes / 60 })
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id

  const [policy, setPolicy] = React.useState<Policy | null>(null)
  const [en, setEn] = React.useState({ cancellationPolicy: '', additionalRules: '' })
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (propertyId) {
      fetchPolicy()
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const fetchPolicy = async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/properties/${propertyId}/policy`)
      const data = await res.json()
      if (data.success) {
        setPolicy(data.data)
        const stored = (data.data as Policy).translations?.en
        setEn({ cancellationPolicy: stored?.cancellationPolicy ?? '', additionalRules: stored?.additionalRules ?? '' })
      } else {
        toast.error(apiError(data.error) || t('loadFailed'))
        setError(apiError(data.error) || t('loadFailed'))
      }
    } catch (err) {
      console.error('Fetch policy error:', err)
      setError(t('loadError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!policy) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInTime: policy.checkInTime,
          checkOutTime: policy.checkOutTime,
          cancellationHours: policy.cancellationHours,
          cancellationPolicy: policy.cancellationPolicy,
          childrenAllowed: policy.childrenAllowed,
          minChildAge: policy.minChildAge,
          petsAllowed: policy.petsAllowed,
          smokingAllowed: policy.smokingAllowed,
          additionalRules: policy.additionalRules,
          onlineDepositPercent: policy.onlineDepositPercent,
          depositDeadlineMinutes: policy.depositDeadlineMinutes,
          lateCheckoutTiers: policy.lateCheckoutTiers,
          translations: { en },
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(apiError(data.error) || t('saveFailed'))
        return
      }
      toast.success(t('saved'))
      setPolicy({ ...data.data, payosConnected: policy.payosConnected })
    } catch (err) {
      console.error('Save policy error:', err)
      toast.error(t('saveError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const update = <K extends keyof Policy>(key: K, value: Policy[K]) => {
    setPolicy((p) => (p ? { ...p, [key]: value } : p))
  }

  // Shown as stored, or the default the server applies when none is stored.
  const lateTiers = policy?.lateCheckoutTiers ?? DEFAULT_LATE_TIERS
  const setTier = (index: number, change: Partial<LateTier>) =>
    update('lateCheckoutTiers', lateTiers.map((tier, i) => (i === index ? { ...tier, ...change } : tier)))

  if (!propertyId) {
    return (
      <PageContainer>
        <Header title={tc('nav.policies')} description={t('noPropertyDescription')} />
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">{t('noProperty')}</p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title={tc('nav.policies')}
        description={t('description')}
        actions={
          <Button onClick={handleSave} isLoading={isSubmitting} disabled={!policy}>
            <Save className="w-4 h-4 mr-2" />
            {tc('actions.saveChanges')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-err mb-4">{error}</p>
            <Button onClick={fetchPolicy}>{tc('actions.retry')}</Button>
          </CardContent>
        </Card>
      ) : policy ? (
        <div className="space-y-6">
          {/* Check-in / Check-out */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {t('times.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    {t('times.checkIn')}
                  </label>
                  <Input
                    type="time"
                    value={policy.checkInTime}
                    onChange={(e) => update('checkInTime', e.target.value)}
                  />
                  <p className="text-xs text-muted mt-1">
                    {t('times.checkInHint')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    {t('times.checkOut')}
                  </label>
                  <Input
                    type="time"
                    value={policy.checkOutTime}
                    onChange={(e) => update('checkOutTime', e.target.value)}
                  />
                  <p className="text-xs text-muted mt-1">
                    {t('times.checkOutHint')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Late check-out (src/lib/bookings/late-checkout.ts) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {t('late.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={lateTiers.length > 0}
                  onChange={(e) => update('lateCheckoutTiers', e.target.checked ? DEFAULT_LATE_TIERS : [])}
                  className="w-4 h-4"
                />
                {t('late.enable', { time: policy.checkOutTime })}
              </label>
              {lateTiers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">{t('late.intro')}</p>
                  {lateTiers.map((tier, i) => (
                    <div key={i} className="grid grid-cols-[84px_108px_1fr] items-center gap-2 sm:gap-3 text-sm text-fg">
                      <span>{tier.until !== null ? t('late.before') : t('late.later')}</span>
                      {tier.until !== null ? (
                        <input
                          type="time"
                          aria-label={t('late.tierTime', { n: i + 1 })}
                          value={tier.until}
                          onChange={(e) => setTier(i, { until: e.target.value })}
                          className={TIER_INPUT}
                        />
                      ) : (
                        <span aria-hidden="true" />
                      )}
                      <span className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={300}
                          aria-label={tier.until !== null ? t('late.surchargeBefore', { time: tier.until }) : t('late.surchargeLater')}
                          value={tier.percent}
                          onChange={(e) => setTier(i, { percent: Math.min(300, Math.max(0, parseInt(e.target.value) || 0)) })}
                          className={`${TIER_INPUT} w-16 sm:w-20`}
                        />
                        <span className="text-muted">%</span>
                      </span>
                    </div>
                  ))}
                  <p className="text-xs text-muted">
                    {t('late.hint')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cancellation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t('cancellation.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  {t('cancellation.freeHours')}
                </label>
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={policy.cancellationHours ?? ''}
                  onChange={(e) =>
                    update(
                      'cancellationHours',
                      e.target.value === '' ? null : parseInt(e.target.value)
                    )
                  }
                  placeholder={t('cancellation.freeHoursPlaceholder')}
                />
                <p className="text-xs text-muted mt-1">
                  {t('cancellation.freeHoursHint')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  {t('cancellation.details')}
                </label>
                <textarea
                  value={policy.cancellationPolicy ?? ''}
                  onChange={(e) => update('cancellationPolicy', e.target.value || null)}
                  placeholder={t('cancellation.detailsPlaceholder')}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-2 focus-visible:ring-acc focus-visible:border-acc focus-visible:border-acc"
                />
                <p className="text-xs text-muted mt-1">
                  {t('cancellation.detailsHint')}
                </p>
              </div>
              <EnglishCopy filled={Boolean(en.cancellationPolicy)}>
                <Textarea
                  label={t('cancellation.details')}
                  value={en.cancellationPolicy}
                  onChange={(e) => setEn({ ...en, cancellationPolicy: e.target.value })}
                  placeholder={policy.cancellationPolicy ?? ''}
                  rows={4}
                />
              </EnglishCopy>
              <div>
                <label htmlFor="online-deposit" className="block text-sm font-medium text-fg mb-1">
                  {t('deposit.label')}
                </label>
                <Input
                  id="online-deposit"
                  type="number"
                  min={0}
                  max={100}
                  value={policy.onlineDepositPercent}
                  onChange={(e) =>
                    update('onlineDepositPercent', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
                  }
                />
                <p className="text-xs text-muted mt-1">
                  {t('deposit.hint')}
                </p>
                {policy.onlineDepositPercent > 0 && (
                  <div className="mt-3">
                    <label htmlFor="deposit-deadline" className="block text-sm font-medium text-fg mb-1">
                      {t('deposit.deadline')}
                    </label>
                    <select
                      id="deposit-deadline"
                      value={policy.depositDeadlineMinutes}
                      onChange={(e) => update('depositDeadlineMinutes', parseInt(e.target.value))}
                      className="w-full h-10 px-3 border border-line rounded-ctl bg-raised text-fg focus-visible:ring-2 focus-visible:ring-acc"
                    >
                      {DEADLINE_OPTIONS.includes(policy.depositDeadlineMinutes) ? null : (
                        <option value={policy.depositDeadlineMinutes}>{t('deposit.minutes', { count: policy.depositDeadlineMinutes })}</option>
                      )}
                      {DEADLINE_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>{deadlineLabel(minutes)}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted mt-1">
                      {t('deposit.deadlineHint')}
                    </p>
                  </div>
                )}
                {policy.onlineDepositPercent > 0 && !policy.payosConnected && (
                  <p className="text-xs text-warn mt-1">
                    {t('deposit.payosMissing')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Children, Pets, Smoking */}
          <Card>
            <CardHeader>
              <CardTitle>{t('rules.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-start gap-3">
                  <Baby className="w-5 h-5 text-muted mt-0.5" />
                  <div>
                    <p className="font-medium">{t('rules.children')}</p>
                    <p className="text-sm text-muted">{t('rules.childrenHint')}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={policy.childrenAllowed}
                    onChange={(e) => update('childrenAllowed', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink" />
                </label>
              </div>

              {policy.childrenAllowed && (
                <div className="ml-12">
                  <label className="block text-sm font-medium text-fg mb-1">
                    {t('rules.minChildAge')}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={18}
                    value={policy.minChildAge}
                    onChange={(e) => update('minChildAge', parseInt(e.target.value) || 0)}
                    className="max-w-[120px]"
                  />
                </div>
              )}

              <div className="flex items-start justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-start gap-3">
                  <Dog className="w-5 h-5 text-muted mt-0.5" />
                  <div>
                    <p className="font-medium">{t('rules.pets')}</p>
                    <p className="text-sm text-muted">{t('rules.petsHint')}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={policy.petsAllowed}
                    onChange={(e) => update('petsAllowed', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink" />
                </label>
              </div>

              <div className="flex items-start justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-start gap-3">
                  <Cigarette className="w-5 h-5 text-muted mt-0.5" />
                  <div>
                    <p className="font-medium">{t('rules.smoking')}</p>
                    <p className="text-sm text-muted">{t('rules.smokingHint')}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={policy.smokingAllowed}
                    onChange={(e) => update('smokingAllowed', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink" />
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Additional rules */}
          <Card>
            <CardHeader>
              <CardTitle>{t('additional.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={policy.additionalRules ?? ''}
                onChange={(e) => update('additionalRules', e.target.value || null)}
                placeholder={t('additional.placeholder')}
                rows={5}
                className="w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-2 focus-visible:ring-acc focus-visible:border-acc focus-visible:border-acc"
              />
              <div className="mt-4">
                <EnglishCopy filled={Boolean(en.additionalRules)}>
                  <Textarea
                    label={t('additional.title')}
                    value={en.additionalRules}
                    onChange={(e) => setEn({ ...en, additionalRules: e.target.value })}
                    placeholder={policy.additionalRules ?? ''}
                    rows={5}
                  />
                </EnglishCopy>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  )
}
