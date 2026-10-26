/**
 * Vietnamese QR (VietQR) payloads for bank transfers, used when the hotel has
 * no PayOS link (PayOS builds its own).
 *
 * Follows the NAPAS VietQR spec, an EMVCo Merchant Presented Mode profile:
 *   - ID 00: Payload Format Indicator ("01")
 *   - ID 01: Point of Initiation (11 = static, no amount; 12 = dynamic, one payment)
 *   - ID 38: Merchant Account Information, NAPAS:
 *       00 = GUID A000000727
 *       01 = beneficiary organization { 00 = 6-digit acquirer BIN, 01 = account number }
 *       02 = service code QRIBFTTA (transfer to an account)
 *   - ID 52: Merchant Category Code, ID 53: currency (704 = VND)
 *   - ID 54: amount (only when there is one), ID 58: country (VN)
 *   - ID 59 / 60: beneficiary name / city, ASCII (no diacritics, upper case)
 *   - ID 62: additional data, sub-tag 08 = transfer content
 *   - ID 63: CRC-16/CCITT-FALSE of everything before it, "6304" included
 *
 * Lengths are counted in bytes; every value here is ASCII once normalized.
 * src/lib/payments/deposit-view.ts reads PayOS payloads of the same shape.
 */
import { findBank } from './banks'

export { VIETQR_BANKS, MOMO_CODE, findBank, bankLabel, isWallet, walletPhone, type VietQrBank } from './banks'

export interface VietQrInput {
  /** The bank's code ("VCB", "MB", old "VTB"...) or its 6-digit BIN; "MOMO" for a MoMo wallet */
  bankCode: string
  /** for a wallet, its phone number */
  accountNumber: string
  accountHolder: string
  /** VND; 0 makes a static QR without an amount */
  amount: number
  /** Transfer content / reference (booking code) */
  addInfo: string
  merchantName?: string
  merchantCity?: string
}

const NAPAS_GUID = 'A000000727'
const SERVICE_TO_ACCOUNT = 'QRIBFTTA'
const COUNTRY = 'VN'
const CURRENCY = '704' // VND

/**
 * Builds the VietQR payload to encode as a QR image (`qrcode.toDataURL(text)`).
 * Throws for a bank without a known BIN: a QR naming no bank would be
 * refused by every banking app.
 */
export function buildVietQr(input: VietQrInput): string {
  const bank = findBank(input.bankCode)
  if (!bank) throw new Error(`Unknown bank code for VietQR: ${input.bankCode}`)
  const accountNumber = input.accountNumber.replace(/[^0-9A-Za-z]/g, '')
  if (!accountNumber) throw new Error('VietQR needs an account number')

  const accountHolder = toBankName(input.accountHolder || input.merchantName || 'MERCHANT') || 'MERCHANT'
  const merchantName = (input.merchantName && toBankName(input.merchantName)) || accountHolder
  const merchantCity = (input.merchantCity && toBankName(input.merchantCity)) || 'HA NOI'
  const addInfo = sanitizeAddInfo(input.addInfo)
  const amount = formatAmount(input.amount)

  const beneficiary = tlv('00', bank.bin) + tlv('01', accountNumber)
  const merchantAccount = tlv('00', NAPAS_GUID) + tlv('01', beneficiary) + tlv('02', SERVICE_TO_ACCOUNT)

  const payload =
    tlv('00', '01') +
    tlv('01', amount ? '12' : '11') +
    tlv('38', merchantAccount) +
    tlv('52', '5999') + // MCC: generic
    tlv('53', CURRENCY) +
    (amount ? tlv('54', amount) : '') +
    tlv('58', COUNTRY) +
    tlv('59', truncate(merchantName, 25)) +
    tlv('60', truncate(merchantCity, 15)) +
    (addInfo ? tlv('62', tlv('08', truncate(addInfo, 50))) : '') +
    '6304'
  return payload + crc16CcittFalse(payload)
}

/**
 * A name as banks print it: Vietnamese letters without diacritics, upper case,
 * single spaces ("Công ty Đà Lạt" → "CONG TY DA LAT").
 */
export function toBankName(name: string): string {
  return name
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining marks
    .toUpperCase()
    .replace(/[^A-Z0-9 .,&()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) over the UTF-8 bytes, 4 hex digits. */
export function crc16CcittFalse(input: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// ============================================
//  Helpers
// ============================================

/** One EMVCo field: id, length in bytes (2 digits), value. */
function tlv(id: string, value: string): string {
  const length = new TextEncoder().encode(value).length
  if (length > 99) throw new Error(`VietQR field ${id} is longer than 99 bytes`)
  return id + String(length).padStart(2, '0') + value
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return Math.round(amount).toString()
}

/** Banks refuse some characters in the transfer content; keep it ASCII. */
function sanitizeAddInfo(s: string): string {
  return toAscii(s).replace(/[^A-Za-z0-9 \-_./]/g, '').replace(/\s+/g, ' ').trim()
}

function toAscii(s: string): string {
  return s.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max).trim() : s
}
