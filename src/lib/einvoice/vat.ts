/**
 * VAT for e-invoices (Part 6). Hotel prices include VAT: what the guest
 * pays is the invoice total, and the net amount and VAT are split from it.
 * (The old form added VAT on top of the booking total, so the invoice said
 * the guest paid 10% more than they did.)
 *
 * The rate is the hotel accountant's choice, stored per property and
 * copied onto each invoice when it is created.
 */
export const VAT_CODES = [10, 8, 5, 0, -1, -2] as const
export type VatCode = (typeof VAT_CODES)[number]

/** Labels for Mắt Bão's TSuat codes. */
export const VAT_LABELS: Record<VatCode, string> = {
  10: '10%',
  8: '8%',
  5: '5%',
  0: '0%',
  [-1]: 'Không chịu thuế (KCT)',
  [-2]: 'Không kê khai, tính nộp thuế (KKKNT)',
}

export function isVatCode(value: unknown): value is VatCode {
  return (VAT_CODES as readonly unknown[]).includes(value)
}

export function vatRateOf(code: VatCode): number {
  return code > 0 ? code / 100 : 0
}

/** Splits a VAT-inclusive amount into whole dong: net + vat = gross exactly. */
export function splitGross(gross: number, code: VatCode) {
  const total = Math.round(gross)
  const rate = vatRateOf(code)
  const net = Math.round(total / (1 + rate))
  return { net, vat: total - net, gross: total, rate }
}
