/**
 * Tax-office status from Mắt Bão (webhook; Mắt Bão support registers the
 * URL, one per hotel account). After issuing, Mắt Bão sends the invoice to
 * the tax office (CQT) and calls back with MaTTHDon: 4 code issued, 6 not
 * eligible (the invoice must be fixed), 9 an error notice (mẫu 04) approved.
 *
 * The payload is unsigned: the secret token in the URL, stored encrypted
 * per property, is the credential. The invoice is matched by Fkey (our
 * MaTraCuu) within that property only. Final statuses (4, 6, 9) are not
 * overwritten by a late, intermediate one.
 */
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db'
import { decryptSecret } from '@/lib/security/secret-box'
import { webhookTokenCtx } from './matbao'
import { CQT_LABELS } from './cqt-labels'

const FINAL = new Set([4, 6, 9])

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function handleMatbaoWebhook(
  propertyId: string,
  token: string,
  body: unknown
): Promise<{ status: number; outcome: string }> {
  const config = await prisma.propertyEinvoice.findUnique({
    where: { propertyId },
    select: { webhookToken: true },
  })
  if (!config?.webhookToken) return { status: 404, outcome: 'not_connected' }
  // A token saved under keys this server no longer has (DATA_ENCRYPTION_KEYS changed) cannot match
  // anything: answer like a wrong token instead of a 500 that makes Mắt Bão retry for nothing. Saving
  // the account again makes a new token (api/properties/[id]/einvoice).
  let saved: string | null = null
  try {
    saved = decryptSecret(config.webhookToken, webhookTokenCtx(propertyId))
  } catch {
    saved = null
  }
  if (saved === null || !sameSecret(token, saved)) {
    return { status: 401, outcome: 'bad_token' }
  }

  const data = (body ?? {}) as Record<string, unknown>
  const fkey = typeof data.Fkey === 'string' ? data.Fkey : null
  const code = Number(data.MaTTHDon)
  if (!fkey || !Number.isInteger(code) || !(code in CQT_LABELS)) return { status: 400, outcome: 'bad_payload' }

  const invoice = await prisma.invoice.findFirst({
    where: { propertyId, lookupCode: fkey },
    select: { id: true, cqtStatus: true, einvoiceNumber: true, invoiceNumber: true },
  })
  // Invoices made on Mắt Bão's portal are not ours: nothing to update.
  if (!invoice) return { status: 200, outcome: 'unknown' }
  if (invoice.cqtStatus != null && FINAL.has(invoice.cqtStatus) && !FINAL.has(code)) {
    return { status: 200, outcome: 'stale' }
  }

  const note = typeof data.GhiChuCQT === 'string' && data.GhiChuCQT.trim() ? data.GhiChuCQT.trim() : null
  const number = data.No != null && data.No !== '' ? String(data.No) : null
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      cqtStatus: code,
      cqtNote: note,
      cqtCode: typeof data.MCCQT === 'string' && data.MCCQT ? data.MCCQT : null,
      // A publish answered 304 left the number empty; Mắt Bão sends it here.
      ...(invoice.einvoiceNumber == null && number && { einvoiceNumber: number }),
    },
  })
  if (code === 6) {
    console.warn(`[einvoice] tax office refused invoice ${invoice.invoiceNumber} (property ${propertyId}): ${note ?? ''}`)
    await prisma.activityLog.create({
      data: {
        propertyId,
        action: 'EINVOICE_CQT_REFUSED',
        entityType: 'INVOICE',
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber, note },
      },
    })
  }
  return { status: 200, outcome: 'updated' }
}
