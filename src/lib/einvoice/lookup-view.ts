/**
 * What the public invoice page shows (task 39, /<subdomain>/hoa-don/<token>):
 * the invoice as it is printed (seller, buyer, number, series, date,
 * amounts, status) and nothing else about the booking or the guest; the PDF
 * says as much. Only invoices the buyer was given: issued ones, and ones
 * replaced since (the page then points at the replacement).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { invoiceLookupToken, readInvoiceLookupToken } from './lookup-link'
import { isVatCode, type VatCode } from './vat'

const SHOWN_STATUSES = ['PUBLISHED', 'REPLACED'] as const

function environmentOf(metadata: Prisma.JsonValue | null): 'DEMO' | 'PRODUCTION' | null {
  const matbao = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata.matbao : null
  const env = matbao && typeof matbao === 'object' && !Array.isArray(matbao) ? matbao.environment : null
  return env === 'DEMO' || env === 'PRODUCTION' ? env : null
}

/**
 * The invoice behind a lookup token, or null (forged token, not issued, or
 * not this hotel's: `subdomain` is the site the page was opened on; null
 * skips that check, for the PDF route).
 */
export async function loadInvoiceLookup(subdomain: string | null, token: string) {
  const id = readInvoiceLookupToken(token)
  if (!id) return null
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      buyerType: true,
      companyName: true,
      companyAddress: true,
      taxCode: true,
      customerName: true,
      subtotal: true,
      taxAmount: true,
      totalAmount: true,
      vatCode: true,
      invoicePattern: true,
      invoiceSeries: true,
      einvoiceNumber: true,
      lookupCode: true,
      publishedAt: true,
      fiscalCode: true,
      cqtCode: true,
      metadata: true,
      property: { select: { subdomain: true, name: true, address: true, einvoice: { select: { taxCode: true } } } },
      replacesInvoice: { select: { einvoiceNumber: true } },
      adjustsInvoice: { select: { einvoiceNumber: true } },
      replacements: { where: { status: 'PUBLISHED' }, select: { id: true, einvoiceNumber: true }, take: 1 },
    },
  })
  if (!invoice || !(SHOWN_STATUSES as readonly string[]).includes(invoice.status) || !invoice.publishedAt) return null
  if (subdomain !== null && invoice.property.subdomain !== subdomain) return null

  const company = invoice.buyerType === 'company'
  const replacement = invoice.replacements[0]
  return {
    id: invoice.id,
    subdomain: invoice.property.subdomain,
    status: invoice.status as (typeof SHOWN_STATUSES)[number],
    environment: environmentOf(invoice.metadata),
    seller: {
      name: invoice.property.name,
      address: invoice.property.address,
      // Recorded when issued; invoices issued before that use the account's.
      taxCode: invoice.fiscalCode ?? invoice.property.einvoice?.taxCode ?? null,
    },
    buyer: {
      kind: invoice.buyerType as 'company' | 'personal' | 'consumer',
      company: company ? invoice.companyName : null,
      taxCode: company ? invoice.taxCode : null,
      address: company ? invoice.companyAddress : null,
      name: invoice.buyerType === 'consumer' ? null : invoice.customerName,
    },
    number: invoice.einvoiceNumber,
    pattern: invoice.invoicePattern,
    series: invoice.invoiceSeries,
    lookupCode: invoice.lookupCode,
    cqtCode: invoice.cqtCode,
    publishedAt: invoice.publishedAt,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    vatCode: isVatCode(invoice.vatCode) ? (invoice.vatCode as VatCode) : null,
    replaces: invoice.replacesInvoice?.einvoiceNumber ?? null,
    adjusts: invoice.adjustsInvoice?.einvoiceNumber ?? null,
    replacedBy: replacement ? { number: replacement.einvoiceNumber, token: invoiceLookupToken(replacement.id) } : null,
  }
}

export type InvoiceLookup = NonNullable<Awaited<ReturnType<typeof loadInvoiceLookup>>>
