'use client'

import * as React from 'react'
import { Input, Select } from '@/components/ui'
import { isVatCode, splitGross, VAT_LABELS } from '@/lib/einvoice/vat'

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

const formatPrice = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)

/** Client-side checks, mirroring src/lib/einvoice/invoices.ts. */
export function validateInvoiceForm(v: InvoiceFormValue): string | null {
  if (v.buyerType === 'company') {
    if (v.companyName.trim().length < 2) return 'Vui lòng nhập tên công ty'
    if (!/^\d{10}(-\d{3})?$/.test(v.taxCode.trim())) return 'Mã số thuế gồm 10 số (hoặc 10 số-3 số)'
    if (v.companyAddress.trim().length < 5) return 'Vui lòng nhập địa chỉ công ty'
  }
  if (v.customerName.trim().length < 2) return 'Vui lòng nhập tên người mua'
  if (!v.customerEmail.includes('@')) return 'Vui lòng nhập email người mua'
  const amount = Number(v.totalAmount)
  if (!Number.isInteger(amount) || amount <= 0) return 'Số tiền phải là số nguyên dương (đồng)'
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
  const set = (patch: Partial<InvoiceFormValue>) => onChange({ ...value, ...patch })
  const amount = Number(value.totalAmount)
  const split = isVatCode(vatCode) && Number.isFinite(amount) && amount > 0 ? splitGross(amount, vatCode) : null

  return (
    <>
      <Select
        label="Người mua"
        value={value.buyerType}
        onChange={(e) => set({ buyerType: e.target.value as InvoiceFormValue['buyerType'] })}
        options={[
          { value: 'company', label: 'Công ty (có mã số thuế)' },
          { value: 'personal', label: 'Cá nhân' },
          { value: 'consumer', label: 'Khách lẻ không lấy hoá đơn' },
        ]}
      />

      {value.buyerType === 'company' && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-fg mb-3">Công ty mua</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tên công ty" required value={value.companyName} onChange={(e) => set({ companyName: e.target.value })} />
            <Input label="Mã số thuế" required value={value.taxCode} onChange={(e) => set({ taxCode: e.target.value })} placeholder="0123456789" />
            <div className="col-span-2">
              <Input label="Địa chỉ công ty" required value={value.companyAddress} onChange={(e) => set({ companyAddress: e.target.value })} />
            </div>
            <Input label="Email nhận hoá đơn" type="email" value={value.companyEmail} onChange={(e) => set({ companyEmail: e.target.value })} />
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <h4 className="font-medium text-fg mb-3">
          {value.buyerType === 'company' ? 'Người mua hàng (đại diện công ty)' : 'Khách hàng'}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Họ tên" required value={value.customerName} onChange={(e) => set({ customerName: e.target.value })} />
          <Input label="Email" required type="email" value={value.customerEmail} onChange={(e) => set({ customerEmail: e.target.value })} />
          {value.buyerType === 'personal' && (
            <div className="col-span-2">
              <Input label="Địa chỉ" value={value.customerAddress} onChange={(e) => set({ customerAddress: e.target.value })} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium text-fg mb-3">Số tiền</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Tổng tiền khách trả (đã gồm VAT)"
            required
            type="number"
            min="0"
            step="1000"
            value={value.totalAmount}
            onChange={(e) => set({ totalAmount: e.target.value })}
          />
          <div className="text-sm text-muted pt-6">
            {split ? (
              <>
                Chưa thuế {formatPrice(split.net)} · Thuế {VAT_LABELS[vatCode as keyof typeof VAT_LABELS]}{' '}
                {formatPrice(split.vat)}
              </>
            ) : (
              'Thuế suất theo cấu hình hoá đơn điện tử của khách sạn'
            )}
          </div>
        </div>
      </div>
    </>
  )
}
