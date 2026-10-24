'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Input, Select } from '@/components/ui'
import { isVatCode, splitGross, type VatCode } from '@/lib/einvoice/vat'
import { useDashLabels } from '@/lib/i18n/dash'
import { useVatLabel } from './einvoice-card'

export interface InvoiceFormValue {
  buyerType: 'company' | 'personal' | 'consumer'
  companyName: string
  companyAddress: string
  taxCode: string
  companyEmail: string
  customerName: string
  customerEmail: string
  customerAddress: string
  /** what the guest pays, VAT included */
  totalAmount: string
}

export const EMPTY_INVOICE_FORM: InvoiceFormValue = {
  buyerType: 'company',
  companyName: '',
  companyAddress: '',
  taxCode: '',
  companyEmail: '',
  customerName: '',
  customerEmail: '',
  customerAddress: '',
  totalAmount: '',
}

/** What is wrong with the form: a key of dash.money.invoices.form.errors. */
export type InvoiceFormError = 'companyName' | 'taxCode' | 'companyAddress' | 'customerName' | 'customerEmail' | 'amount'

/** Client-side checks, mirroring src/lib/einvoice/invoices.ts. */
export function validateInvoiceForm(v: InvoiceFormValue): InvoiceFormError | null {
  if (v.buyerType === 'company') {
    if (v.companyName.trim().length < 2) return 'companyName'
    if (!/^\d{10}(-\d{3})?$/.test(v.taxCode.trim())) return 'taxCode'
    if (v.companyAddress.trim().length < 5) return 'companyAddress'
  }
  if (v.customerName.trim().length < 2) return 'customerName'
  if (!v.customerEmail.includes('@')) return 'customerEmail'
  const amount = Number(v.totalAmount)
  if (!Number.isInteger(amount) || amount <= 0) return 'amount'
  return null
}

export function invoiceFormBody(v: InvoiceFormValue) {
  return {
    buyerType: v.buyerType,
    companyName: v.companyName,
    companyAddress: v.companyAddress,
    taxCode: v.taxCode,
    companyEmail: v.companyEmail || undefined,
    customerName: v.customerName,
    customerEmail: v.customerEmail,
    customerAddress: v.customerAddress || undefined,
    totalAmount: Number(v.totalAmount),
  }
}

/** Buyer and amount fields, shared by the create and edit dialogs (Part 6). */
export function InvoiceFormFields({
  value,
  onChange,
  vatCode,
}: {
  value: InvoiceFormValue
  onChange: (next: InvoiceFormValue) => void
  vatCode: number | undefined
}) {
  const t = useTranslations('dash.money.invoices.form')
  const formatPrice = useDashLabels().money
  const vatLabel = useVatLabel()
  const set = (patch: Partial<InvoiceFormValue>) => onChange({ ...value, ...patch })
  const amount = Number(value.totalAmount)
  const split = isVatCode(vatCode) && Number.isFinite(amount) && amount > 0 ? splitGross(amount, vatCode) : null

  return (
    <>
      <Select
        label={t('buyer')}
        value={value.buyerType}
        onChange={(e) => set({ buyerType: e.target.value as InvoiceFormValue['buyerType'] })}
        options={[
          { value: 'company', label: t('buyerCompany') },
          { value: 'personal', label: t('buyerPersonal') },
          { value: 'consumer', label: t('buyerConsumer') },
        ]}
      />

      {value.buyerType === 'company' && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-fg mb-3">{t('companySection')}</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('companyName')} required value={value.companyName} onChange={(e) => set({ companyName: e.target.value })} />
            <Input label={t('taxCode')} required value={value.taxCode} onChange={(e) => set({ taxCode: e.target.value })} placeholder="0123456789" />
            <div className="col-span-2">
              <Input label={t('companyAddress')} required value={value.companyAddress} onChange={(e) => set({ companyAddress: e.target.value })} />
            </div>
            <Input label={t('companyEmail')} type="email" value={value.companyEmail} onChange={(e) => set({ companyEmail: e.target.value })} />
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <h4 className="font-medium text-fg mb-3">
          {value.buyerType === 'company' ? t('buyerRep') : t('customer')}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('name')} required value={value.customerName} onChange={(e) => set({ customerName: e.target.value })} />
          <Input label="Email" required type="email" value={value.customerEmail} onChange={(e) => set({ customerEmail: e.target.value })} />
          {value.buyerType === 'personal' && (
            <div className="col-span-2">
              <Input label={t('address')} value={value.customerAddress} onChange={(e) => set({ customerAddress: e.target.value })} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium text-fg mb-3">{t('amountSection')}</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('total')}
            required
            type="number"
            min="0"
            step="1000"
            value={value.totalAmount}
            onChange={(e) => set({ totalAmount: e.target.value })}
          />
          <div className="text-sm text-muted pt-6">
            {split
              ? t('split', { net: formatPrice(split.net), rate: vatLabel(vatCode as VatCode), vat: formatPrice(split.vat) })
              : t('vatHint')}
          </div>
        </div>
      </div>
    </>
  )
}
