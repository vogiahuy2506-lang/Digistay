/**
 * The hotel's public site is cached (src/lib/public-site/site.ts). Every
 * API handler that writes what it shows must drop that cache with
 * invalidatePublicSite(), or an edit stays invisible for up to five
 * minutes. This reads the source, like route-policy.test.ts: a new handler
 * that forgets fails here, before review.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const API = path.join(process.cwd(), 'src', 'app', 'api')
const LIB = path.join(process.cwd(), 'src', 'lib')

/** Models whose rows the public site shows. */
const SITE_MODELS = [
  'property',
  'propertyImage',
  'propertyAmenity',
  'roomType',
  'roomTypeImage',
  'roomTypeAmenity',
  'roomTypePricing',
  'pricingConfig',
  'extraService',
  'menuItem',
  'websiteBlock',
  'websiteSettings',
]
const WRITE = new RegExp(`\\b(?:prisma|tx)\\.(${SITE_MODELS.join('|')})\\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\\(`)

/** Handlers that write those models but change nothing the site shows. */
const EXEMPT: Record<string, string> = {
  'POST /api/properties': 'creates a property: nothing of it is cached yet',
  'POST /api/website/domain/verify': 'stores the custom domain, which the site does not show',
  'POST /api/website/ssl/provision': 'stores the SSL status, which the site does not show',
  'DELETE /api/website/ssl/provision': 'clears the SSL status, which the site does not show',
}

function files(dir: string, keep: (f: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? files(full, keep) : keep(full) ? [full] : []
  })
}

/** Each exported handler's source: from its `export async function` to the next. */
function handlers(source: string) {
  const starts = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)]
  return starts.map((m, i) => ({ method: m[1], body: source.slice(m.index, starts[i + 1]?.index ?? source.length) }))
}

describe('public site cache', () => {
  it('every handler that writes what the site shows drops its cache', () => {
    const missing: string[] = []
    for (const file of files(API, (f) => f.endsWith(`${path.sep}route.ts`))) {
      const route = '/' + path.relative(path.join(process.cwd(), 'src', 'app'), path.dirname(file)).split(path.sep).join('/')
      for (const { method, body } of handlers(readFileSync(file, 'utf8'))) {
        const key = `${method} ${route}`
        if (WRITE.test(body) && !body.includes('invalidatePublicSite(') && !EXEMPT[key]) missing.push(key)
      }
    }
    expect(missing, 'call invalidatePublicSite(propertyId) after the write, or list the handler in EXEMPT with a reason').toEqual([])
  })

  it('no library code writes those models behind the handlers’ back', () => {
    const writers = files(LIB, (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => WRITE.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(process.cwd(), f))
    expect(writers).toEqual([])
  })

  it('every exemption still exists (a stale entry would hide nothing)', () => {
    for (const key of Object.keys(EXEMPT)) {
      const [method, route] = key.split(' ')
      const source = readFileSync(path.join(process.cwd(), 'src', 'app', route, 'route.ts'), 'utf8')
      const handler = handlers(source).find((h) => h.method === method)
      expect(handler && WRITE.test(handler.body), key).toBe(true)
    }
  })
})
