import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JsonLd } from '@/components/seo/JsonLd'
import { serializeJsonLd } from './json-ld'

const hostile = {
  '@type': 'Hotel',
  name: 'Mây</script><script>alert(1)</script>',
  description: 'Tom & Jerry <!-- --> \u2028 \u2029 "quoted"',
}

describe('serializeJsonLd', () => {
  it('cannot end the script element or open a comment', () => {
    const out = serializeJsonLd(hostile)
    expect(out).not.toMatch(/[<>&\u2028\u2029]/)
    expect(out).toContain('Mây\\u003c/script\\u003e\\u003cscript\\u003e')
    expect(out).toContain('Tom \\u0026 Jerry \\u003c!-- --\\u003e \\u2028 \\u2029')
  })

  it('reads back as the same data', () => {
    expect(JSON.parse(serializeJsonLd(hostile))).toEqual(hostile)
    expect(JSON.parse(serializeJsonLd({ a: [1, 'Đà Lạt', null, true] }))).toEqual({ a: [1, 'Đà Lạt', null, true] })
  })

  it('is valid JSON for anything JSON.stringify drops', () => {
    expect(serializeJsonLd(undefined)).toBe('null')
  })
})

describe('JsonLd', () => {
  it('renders one script whose text is the escaped JSON', () => {
    const html = renderToStaticMarkup(<JsonLd data={hostile} />)
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html.endsWith('</script>')).toBe(true)
    const text = html.slice('<script type="application/ld+json">'.length, -'</script>'.length)
    expect(JSON.parse(text)).toEqual(hostile)
  })
})
