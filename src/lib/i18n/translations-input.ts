/**
 * Saving the hotel's English texts (`translations.en`, read by
 * src/lib/i18n/content.ts). Forms send `translations: { en: { name, ... } }`
 * with the fields they edit; a blank one removes that English text.
 */
import { Prisma } from '@prisma/client'
import { z } from 'zod'

type EnInput = { en: Record<string, string | null | undefined> }

/** The request body's `translations` for a row whose English `fields` can be edited. */
export function translationsInput<F extends string>(fields: readonly F[], max = 5000) {
  const text = z.string().max(max).nullable().optional()
  const shape = Object.fromEntries(fields.map((f) => [f, text])) as Record<F, typeof text>
  // null or missing: leave the stored English texts as they are.
  return z.object({ en: z.object(shape).strict() }).nullish()
}

/**
 * The `translations` to store: the stored English texts with the sent ones
 * set (trimmed) or, when blank, removed. Undefined (leave the column alone)
 * when nothing was sent; DbNull when no English text is left.
 */
export function mergeTranslations(stored: unknown, input: EnInput | null | undefined) {
  if (!input) return undefined
  const en: Record<string, string> = {}
  const old = (stored as { en?: Record<string, unknown> } | null | undefined)?.en
  for (const [key, value] of Object.entries(old ?? {})) {
    if (typeof value === 'string' && value.trim()) en[key] = value
  }
  for (const [key, value] of Object.entries(input.en)) {
    if (value === undefined) continue
    const text = value?.trim()
    if (text) en[key] = text
    else delete en[key]
  }
  return Object.keys(en).length ? ({ en } satisfies Prisma.InputJsonValue) : Prisma.DbNull
}
