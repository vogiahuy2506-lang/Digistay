import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import en from './api-errors.en.json'
import { apiError, compileApiErrors, setApiErrorDictionary, translateWith } from './api-errors'

const ROOT = path.resolve(__dirname, '../../..')
const VIETNAMESE = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i

/** The lib modules whose messages reach the browser in `error` / `message` (besides src/app/api). */
const LIB = [
  'validations/index.ts', 'einvoice/matbao.ts', 'einvoice/invoices.ts', 'einvoice/adjustment.ts', 'einvoice/replacement.ts',
  'einvoice/delivery.ts', 'einvoice/matbao-client.ts', 'einvoice/vat.ts', 'einvoice/jobs.ts', 'payments/payos.ts',
  'payments/guest-deposit.ts', 'bookings/create-booking.ts', 'auth/rbac.ts', 'auth/index.ts', 'marketing/contact.ts',
  'hooks/use-workspace.ts', 'hooks/use-property.ts', 'pricing/rates.ts', 'security/secret-box.ts', 'bookings/late-checkout.ts',
]

function apiFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return apiFiles(p)
    return e.name.endsWith('.ts') && !e.name.includes('.test.') ? [p] : []
  })
}

/** The string literals of a file (comments skipped); `${…}` in template literals become {0}, {1}… */
function literals(s: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    if (s.startsWith('//', i)) { const j = s.indexOf('\n', i); i = j < 0 ? s.length : j; continue }
    if (s.startsWith('/*', i)) { const j = s.indexOf('*/', i); i = j < 0 ? s.length : j + 2; continue }
    const q = s[i]
    if (q === "'" || q === '"' || q === '`') {
      let j = i + 1
      let buf = ''
      let n = 0
      while (j < s.length) {
        const c = s[j]
        if (c === '\\') { buf += s[j + 1] === 'n' ? '\n' : s[j + 1]; j += 2; continue }
        if (q === '`' && s.startsWith('${', j)) {
          let k = j + 2
          let depth = 1
          while (k < s.length && depth) { depth += s[k] === '{' ? 1 : s[k] === '}' ? -1 : 0; k++ }
          buf += `{${n++}}`
          j = k
          continue
        }
        if (c === q || (q !== '`' && c === '\n')) break
        buf += c
        j++
      }
      out.push(buf)
      i = j + 1
      continue
    }
    i++
  }
  return out
}

describe('the API messages in English', () => {
  it('has an English text for every Vietnamese message in the API code', () => {
    const files = [...apiFiles(path.join(ROOT, 'src/app/api')), ...LIB.map((f) => path.join(ROOT, 'src/lib', f))]
    const missing = new Set<string>()
    for (const file of files) {
      for (const text of literals(fs.readFileSync(file, 'utf8'))) {
        if (VIETNAMESE.test(text) && !(text in en)) missing.add(`${path.relative(ROOT, file)}: ${text}`)
      }
    }
    // Add the English text to src/lib/i18n/api-errors.en.json ({0}, {1}… for the values).
    expect([...missing]).toEqual([])
  })

  it('keeps the values of the messages built from them', () => {
    const t = compileApiErrors({
      'Còn {0} phòng': '{0} rooms left',
      'Phòng {0} đã được đặt từ {1}': 'Room {0} has been booked since {1}',
      'Từ {0} đến {1}': 'Between {1} and {0}',
    })
    expect(translateWith(t, 'Còn 3 phòng')).toBe('3 rooms left')
    expect(translateWith(t, 'Phòng 101 đã được đặt từ 20/10')).toBe('Room 101 has been booked since 20/10')
    expect(translateWith(t, 'Từ A đến B')).toBe('Between B and A')
    expect(translateWith(t, 'Không biết')).toBeUndefined()
  })
})

describe('apiError', () => {
  afterEach(() => setApiErrorDictionary(undefined))

  it('shows the message as is on Vietnamese pages', () => {
    expect(apiError('Vui lòng đăng nhập')).toBe('Vui lòng đăng nhập')
    expect(apiError(undefined)).toBeUndefined()
    expect(apiError('')).toBeUndefined()
  })

  it('translates on English pages; an unknown Vietnamese message gives way to the caller’s fallback', () => {
    setApiErrorDictionary(en)
    expect(apiError('Vui lòng đăng nhập')).toBe('Please sign in')
    expect(apiError('Câu này không có trong từ điển') ?? 'fallback').toBe('fallback')
    expect(apiError('Unauthorized')).toBe('Unauthorized')
  })
})
