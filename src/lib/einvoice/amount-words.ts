/**
 * Reads a VND amount in Vietnamese words, for the invoice's "số tiền bằng
 * chữ" (Mắt Bão TgTTTBChu). Same rules as Founder AI's reviewed version:
 * mốt/lăm/lẻ, "không trăm" inside a number.
 */
const ONES = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const SCALES = [
  { value: 1_000_000_000_000, name: 'nghìn tỷ' },
  { value: 1_000_000_000, name: 'tỷ' },
  { value: 1_000_000, name: 'triệu' },
  { value: 1_000, name: 'nghìn' },
  { value: 1, name: '' },
]

/** One group of three digits; `full` once a higher group was read. */
function readThreeDigits(n: number, full: boolean): string {
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10
  const parts: string[] = []

  if (hundreds > 0) parts.push(`${ONES[hundreds]} trăm`)
  else if (full && (tens > 0 || ones > 0)) parts.push('không trăm')

  if (tens > 1) {
    parts.push(`${ONES[tens]} mươi`)
    if (ones === 1) parts.push('mốt')
    else if (ones === 5) parts.push('lăm')
    else if (ones > 0) parts.push(ONES[ones])
  } else if (tens === 1) {
    parts.push('mười')
    if (ones === 5) parts.push('lăm')
    else if (ones > 0) parts.push(ONES[ones])
  } else if (ones > 0) {
    parts.push(full || hundreds > 0 ? `lẻ ${ONES[ones]}` : ONES[ones])
  }
  return parts.join(' ')
}

export function vndToWords(amount: number): string {
  // A decrease adjustment is negative on the invoice ("ghi dấu âm").
  if (Math.round(amount) < 0) {
    const words = vndToWords(-amount)
    return `Âm ${words.charAt(0).toLowerCase()}${words.slice(1)}`
  }
  let remaining = Math.max(0, Math.round(amount))
  if (remaining === 0) return 'Không đồng'

  const parts: string[] = []
  let started = false
  for (const scale of SCALES) {
    const chunk = Math.floor(remaining / scale.value)
    remaining %= scale.value
    if (chunk === 0) continue
    const text = readThreeDigits(chunk, started)
    parts.push(scale.name ? `${text} ${scale.name}` : text)
    started = true
  }
  const body = parts.join(' ')
  return `${body.charAt(0).toUpperCase()}${body.slice(1)} đồng`
}
