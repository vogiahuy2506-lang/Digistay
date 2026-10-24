/**
 * The API's messages (`error`, `message`, form validation) in the visitor's
 * language. The routes keep answering in Vietnamese; English visitors get the
 * dictionary api-errors.en.json (Vietnamese text → English text) through
 * ApiErrorsProvider, and the pages pass what the API said through apiError().
 *
 * Keys with {0}, {1}… are messages built from values (`Còn ${n} phòng`): the
 * values are matched and carried over into the English text.
 * src/lib/i18n/api-errors.test.ts checks that every Vietnamese message in the
 * API code has an English entry.
 */

export type ApiErrorDictionary = Record<string, string>

const VIETNAMESE = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i

interface Compiled {
  exact: Map<string, string>
  patterns: { re: RegExp; en: string }[]
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function compileApiErrors(dictionary: ApiErrorDictionary): Compiled {
  const exact = new Map<string, string>()
  const patterns: Compiled['patterns'] = []
  for (const [vi, en] of Object.entries(dictionary)) {
    if (!/\{\d+\}/.test(vi)) {
      exact.set(vi, en)
      continue
    }
    // "Còn {0} phòng" → /^Còn (.+?) phòng$/ (the order of the groups is the order of {n} in the key).
    const order: number[] = []
    const source = escape(vi).replace(/\\\{(\d+)\\\}/g, (_, n: string) => {
      order.push(Number(n))
      return '([\\s\\S]+?)'
    })
    patterns.push({
      re: new RegExp(`^${source}$`),
      en: en.replace(/\{(\d+)\}/g, (_, n: string) => `\u0000${order.indexOf(Number(n))}\u0000`),
    })
  }
  return { exact, patterns }
}

/** `message` in English with `compiled`; undefined when the dictionary doesn't know it. */
export function translateWith(compiled: Compiled, message: string): string | undefined {
  const text = message.trim()
  const hit = compiled.exact.get(text)
  if (hit !== undefined) return hit
  for (const { re, en } of compiled.patterns) {
    const m = re.exec(text)
    if (m) return en.replace(/\u0000(\d+)\u0000/g, (_, i: string) => m[Number(i) + 1] ?? '')
  }
  return undefined
}

// The browser's dictionary: set by ApiErrorsProvider for English pages, empty otherwise.
let active: Compiled | null = null

export function setApiErrorDictionary(dictionary: ApiErrorDictionary | null | undefined) {
  active = dictionary && Object.keys(dictionary).length ? compileApiErrors(dictionary) : null
}

/**
 * What the API said, in the page's language: as is on Vietnamese pages; on
 * English pages its translation, or undefined when there is none and the text
 * is Vietnamese (the caller's own fallback, `apiError(data.error) || t('…')`,
 * then shows). Non-strings and empty strings give undefined.
 */
export function apiError(message: unknown): string | undefined {
  if (typeof message !== 'string' || !message.trim()) return undefined
  if (!active) return message
  return translateWith(active, message) ?? (VIETNAMESE.test(message) ? undefined : message)
}
