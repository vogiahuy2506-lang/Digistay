/**
 * The nginx config the deploy renders (docker/nginx/conf.d): who may name
 * the client's IP. getClientIp() trusts X-Real-IP, which nginx sets to
 * $remote_addr, so a wrong set_real_ip_from would let anyone choose the IP
 * that rate limits and lockouts count. Checked for real (nginx in Docker,
 * spoofed vs Cloudflare-sourced header) when cloudflare-real-ip.inc was added.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const conf = (name) => readFileSync(new URL(`../docker/nginx/conf.d/${name}`, import.meta.url), 'utf8')
const inc = conf('cloudflare-real-ip.inc')
const ranges = [...inc.matchAll(/^set_real_ip_from\s+(\S+);$/gm)].map((m) => m[1])

describe('Cloudflare real IP', () => {
  it('takes CF-Connecting-IP, and only from Cloudflare ranges', () => {
    expect(inc).toMatch(/^real_ip_header CF-Connecting-IP;$/m)
    expect(inc).not.toMatch(/X-Forwarded-For/i)
    expect(ranges.filter((r) => r.includes('.')).length).toBeGreaterThanOrEqual(10)
    expect(ranges.filter((r) => r.includes(':')).length).toBeGreaterThanOrEqual(5)
    for (const r of ranges) expect(r).toMatch(/^([0-9.]+\/\d{1,2}|[0-9a-f:]+\/\d{1,3})$/)
    // Never a catch-all or private network: those callers could pick their IP.
    for (const bad of [/^0\.0\.0\.0\//, /^::\//, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^127\./, /^fc|^fd/]) {
      expect(ranges.filter((r) => bad.test(r))).toEqual([])
    }
    // Every line is a range or the header: nothing else slips in.
    const other = inc.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !/^(set_real_ip_from|real_ip_header) /.test(l))
    expect(other).toEqual([])
  })

  it('is included in the HTTPS server block', () => {
    const template = conf('app-secure.conf.template')
    expect(template).toContain('include /etc/nginx/conf.d/cloudflare-real-ip.inc;')
    // X-Real-IP stays $remote_addr: the real-ip module is what rewrites it.
    expect(template).toMatch(/proxy_set_header X-Real-IP\s+\$remote_addr;/)
  })
})
