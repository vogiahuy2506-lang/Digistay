/**
 * Whole numbers with thousands separators while they are typed
 * (src/components/ui/number-input.tsx): 1.000.000 in Vietnamese, 1,000,000
 * in English. No DOM here, so it is tested on its own.
 */

/** The separator of thousands in the page's language. */
export const thousandsSeparator = (locale: string) => (locale === 'en' ? ',' : '.')

/** The digits of what was typed or pasted ("1.500.000 ₫" → "1500000"), without leading zeros. */
export function digitsOf(text: string): string {
  const digits = text.replace(/\D/g, '')
  return digits.replace(/^0+(?=\d)/, '')
}

/** "1500000" → "1.500.000". */
export function groupDigits(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}

/** Where the caret goes in `shown` to stand after its first `count` digits. */
export function caretAfterDigits(shown: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < shown.length; i++) {
    if (/\d/.test(shown[i]) && ++seen === count) return i + 1
  }
  return shown.length
}

/** How many digits of `text` stand before `position`. */
export const digitsBefore = (text: string, position: number) => text.slice(0, position).replace(/\D/g, '').length
