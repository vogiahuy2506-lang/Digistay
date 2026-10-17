/**
 * Vietnamese QR (VietQR) generator for bank transfers.
 *
 * Implements the EMVCo QR spec used by Vietnamese banks under the
 * Napas / VietQR standard. The generated string can be:
 *   - Encoded as a QR image for the customer to scan
 *   - Used with any standard QR library (qrcode.react, qrcode, etc.)
 *
 * Reference: https://www.vietqr.io/ (VietQR technical spec)
 *
 * Format follows the EMVCo Merchant Presented Mode specification:
 *   - ID 00: Payload Format Indicator
 *   - ID 01: Point of Initiation Method (11 = static, 12 = dynamic)
 *   - ID 26-51: Merchant Account Information (VietQR sub-IDs)
 *   - ID 52: Merchant Category Code
 *   - ID 53: Transaction Currency (704 = VND)
 *   - ID 54: Transaction Amount
 *   - ID 58: Country Code (VN)
 *   - ID 59: Merchant Name
 *   - ID 60: Merchant City
 *   - ID 62: Additional Data Field Template (contains reference)
 *   - ID 63: CRC (computed last)
 */

export interface VietQrInput {
  bankCode: string // Bin code of the bank, e.g. "VCB", "TCB", "MB"
  accountNumber: string // Bank account number
  accountHolder: string // Account holder name (UPPERCASE, no diacritics)
  amount: number // Amount in VND
  addInfo: string // Transfer content / reference (booking code)
  merchantName?: string
  merchantCity?: string
}

const COUNTRY = 'VN'
const CURRENCY = '704' // VND

/**
 * Builds a VietQR-compliant string from the given bank account +
 * transaction data. Returns the raw string that should be encoded
 * as a QR code (the app should pipe this to a QR generator, e.g.
 * `qrcode.toDataURL(text)` or `<QRCodeCanvas value={text} />`).
 */
export function buildVietQr(input: VietQrInput): string {
  const accountHolder = normalizeName(input.accountHolder || input.merchantName || 'MERCHANT')
  const merchantName = input.merchantName ?? accountHolder
  const merchantCity = input.merchantCity ?? 'HA NOI'
  const addInfo = sanitizeAddInfo(input.addInfo)
  const amount = formatAmount(input.amount)

  // Build merchant account information template (ID 26)
  // VietQR sub-tags:
  //   00: GUID (empty if not Napas direct)
  //   01: Bank BIN
  //   02: Account number
  //   03: Optional — service code (QRIBFTTA = to account)
  //   04: Optional — description
  //   05: Optional — display name
  const merchantAcct =
    subTag('00', '') +
    subTag('01', input.bankCode) +
    subTag('02', input.accountNumber) +
    subTag('03', 'QRIBFTTA') +
    subTag('05', truncate(accountHolder, 25))

  // Build additional data template (ID 62) — contains the reference
  const additionalData = subTag('08', truncate(addInfo, 50))

  // Assemble all TLVs except CRC (ID 63)
  const tlv =
    subTag('00', '01') + // Payload format indicator
    subTag('01', '12') + // Dynamic QR (per-transaction amount)
    subTag('26', merchantAcct) +
    subTag('52', '5999') + // MCC — generic
    subTag('53', CURRENCY) +
    subTag('54', amount) +
    subTag('58', COUNTRY) +
    subTag('59', truncate(merchantName, 25)) +
    subTag('60', truncate(merchantCity, 15)) +
    subTag('62', additionalData)

  // CRC is computed over the whole string with a placeholder "6304"
  // appended, then 4 hex chars of CRC-16/CCITT are written back.
  const crc = crc16Ccitt(tlv + '6304')
  return tlv + '6304' + crc
}

// ============================================
//  Helpers
// ============================================

function subTag(id: string, value: string): string {
  return id + pad2(value.length) + value
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return Math.round(amount).toString()
}

function normalizeName(name: string): string {
  // VietQR requires uppercase, no diacritics for the receiver name
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .toUpperCase()
    .replace(/[^A-Z0-9 .]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeAddInfo(s: string): string {
  // Some banks refuse certain characters in the addInfo field.
  return s.replace(/[^A-Za-z0-9 \-_./]/g, '').trim()
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s
}

// ============================================
//  CRC-16/CCITT (polynomial 0x1021, init 0xFFFF)
// ============================================

function crc16Ccitt(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
