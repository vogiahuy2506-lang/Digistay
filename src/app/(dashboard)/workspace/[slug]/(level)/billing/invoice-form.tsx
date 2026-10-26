'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { normalizeTaxCode } from '@/lib/einvoice/tax-code'
import { useTaxLookup } from '@/lib/hooks/use-tax-lookup'

export const BUYER_TYPES = ['none', 'personal', 'company'] as const
export type BuyerType = (typeof BUYER_TYPES)[number]

export interface BuyerDraft {
  type: BuyerType
  name: string
  idNumber: string
  address: string
  taxCode: string
  companyName: string
}

/** The buyer of the last payment (GET subscription → einvoice.lastBuyer), or an empty form. */
export function initialBuyer(last: Partial<BuyerDraft> | null | undefined): BuyerDraft {
  return {
    type: last?.type && (BUYER_TYPES as readonly string[]).includes(last.type) ? last.type : 'none',
    name: last?.name ?? '',
    idNumber: last?.idNumber ?? '',
    address: last?.address ?? '',
    taxCode: last?.taxCode ?? '',
    companyName: last?.companyName ?? '',
  }
}

/** What the checkout route takes (src/lib/billing/einvoice.ts invoiceBuyerSchema). */
export function buyerPayload(d: BuyerDraft) {
  if (d.type === 'personal') return { type: d.type, name: d.name.trim(), idNumber: d.idNumber.trim(), address: d.address.trim() || undefined }
  if (d.type === 'company') {
    return { type: d.type, taxCode: d.taxCode.trim(), companyName: d.companyName.trim(), address: d.address.trim(), name: d.name.trim() || undefined }
  }
  return { type: 'none' as const }
}

type Problem = 'name' | 'idNumber' | 'taxCode' | 'companyName' | 'address'

/** The first field the server would refuse, checked here so the QR is not made for nothing. */
function problems(d: BuyerDraft): Partial<Record<Problem, true>> {
  const out: Partial<Record<Problem, true>> = {}
  if (d.type === 'personal') {
    if (d.name.trim().length < 2) out.name = true
    if (!/^(\d{9}|\d{12})$/.test(d.idNumber.trim())) out.idNumber = true
  }
  if (d.type === 'company') {
    if (!normalizeTaxCode(d.taxCode)) out.taxCode = true
    if (d.companyName.trim().length < 2) out.companyName = true
    if (d.address.trim().length < 5) out.address = true
  }
  return out
}

export const buyerValid = (d: BuyerDraft) => Object.keys(problems(d)).length === 0

/**
 * Who the plan payment's e-invoice is for, like Founder AI's checkout:
 * none (Digistay still issues it, to a consumer, and sends nothing),
 * a person (name + CCCD) or a company (tax code, filled in from the tax
 * register, name, address). The PDF goes to the payer's email.
 */
export function InvoiceForm({
  value,
  onChange,
  email,
  vat,
  showErrors,
}: {
  value: BuyerDraft
  onChange: (next: BuyerDraft) => void
  email: string | null
  vat: string
  showErrors: boolean
}) {
  const t = useTranslations('dash.billing.invoice')
  const set = (patch: Partial<BuyerDraft>) => onChange({ ...value, ...patch })
  const lookup = useTaxLookup(
    value.taxCode,
    (company) => onChange({ ...value, taxCode: company.taxCode, companyName: company.name, address: company.address }),
    value.type === 'company',
  )
  const bad = showErrors ? problems(value) : {}

  return (
    <fieldset className="grid gap-4">
      <legend className="text-label uppercase text-muted">{t('title')}</legend>
      <div role="radiogroup" aria-label={t('title')} className="grid grid-cols-3 rounded-ctl border border-line bg-page p-1">
        {BUYER_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={value.type === type}
            onClick={() => set({ type })}
            className={cn(
              'min-h-9 rounded-[6px] px-2 py-1.5 text-small font-medium leading-tight transition-colors duration-160',
              value.type === type ? 'bg-ink text-on-ink' : 'text-fg/80 hover:text-fg',
            )}
          >
            {t(`type.${type}`)}
          </button>
        ))}
      </div>

      {value.type === 'none' && <p className="text-small text-muted">{t('noneNote')}</p>}

      {value.type === 'personal' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('name')} required value={value.name} onChange={(e) => set({ name: e.target.value })} error={bad.name && t('errors.name')} autoComplete="name" />
          <Input
            label={t('idNumber')}
            required
            inputMode="numeric"
            value={value.idNumber}
            onChange={(e) => set({ idNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
            error={bad.idNumber && t('errors.idNumber')}
          />
          <div className="sm:col-span-2">
            <Input label={t('address')} value={value.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" />
          </div>
        </div>
      )}

      {value.type === 'company' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('taxCode')}
            required
            inputMode="numeric"
            value={value.taxCode}
            onChange={(e) => set({ taxCode: e.target.value })}
            error={bad.taxCode && t('errors.taxCode')}
            hint={
              lookup.state.status === 'loading'
                ? t('lookup.loading')
                : lookup.state.status === 'found'
                  ? lookup.state.company.active
                    ? t('lookup.found')
                    : t('lookup.inactive', { status: lookup.state.company.status ?? '' })
                  : lookup.state.status === 'missing'
                    ? t('lookup.missing')
                    : lookup.state.status === 'failed'
                      ? t('lookup.failed')
                      : t('lookup.hint')
            }
          />
          <Input label={t('companyName')} required value={value.companyName} onChange={(e) => set({ companyName: e.target.value })} error={bad.companyName && t('errors.companyName')} />
          <div className="sm:col-span-2">
            <Input label={t('companyAddress')} required value={value.address} onChange={(e) => set({ address: e.target.value })} error={bad.address && t('errors.address')} />
          </div>
          <div className="sm:col-span-2">
            <Input label={t('buyerName')} value={value.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
          </div>
        </div>
      )}

      <p className="text-small text-muted">
        {value.type !== 'none' && email ? `${t('sentTo', { email })} ` : ''}
        {t('vat', { vat })}
      </p>
    </fieldset>
  )
}
