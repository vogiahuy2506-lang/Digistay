import { describe, it, expect } from 'vitest'
import { IntlMessageFormat } from 'intl-messageformat'
import vi from '../../messages/vi.json'
import en from '../../messages/en.json'
import dashVi from '../../messages/dash/vi'
import dashEn from '../../messages/dash/en'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? { ...all, [path]: value } : { ...all, ...flatten(value, path) }
  }, {})
}

/** The arguments a message takes: {name}, {count, plural, ...}. */
const args = (message: string) => [...new Set([...message.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]))].sort()

// The dashboard's files (messages/dash) are checked with the rest, as `dash`.
const flat = { vi: flatten({ ...vi, dash: dashVi } as Tree), en: flatten({ ...en, dash: dashEn } as Tree) }

describe('messages', () => {
  it('English has exactly the Vietnamese keys', () => {
    expect(Object.keys(flat.en).sort()).toEqual(Object.keys(flat.vi).sort())
  })

  it.each(['vi', 'en'] as const)('%s: no empty message, every one valid ICU', (locale) => {
    for (const [key, message] of Object.entries(flat[locale])) {
      expect(message.trim(), key).not.toBe('')
      expect(() => new IntlMessageFormat(message, locale), key).not.toThrow()
    }
  })

  it('both languages take the same arguments', () => {
    for (const key of Object.keys(flat.vi)) {
      expect(args(flat.en[key] ?? ''), key).toEqual(args(flat.vi[key]))
    }
  })
})
