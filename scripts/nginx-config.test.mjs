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

describe("hotels' own domains (custom-domains.conf)", () => {
  const site = conf('custom-domains.conf')
  const headers = conf('security-headers-site.inc')

  it('is the default HTTPS server and picks the certificate by SNI, from plain hostnames only', () => {
    expect(site).toMatch(/listen 443 ssl default_server;/)
    expect(site).toMatch(/ssl_certificate\s+\/etc\/letsencrypt\/live\/\$digistay_site_cert\/fullchain\.pem;/)
    expect(site).toMatch(/ssl_certificate_key\s+\/etc\/letsencrypt\/live\/\$digistay_site_cert\/privkey\.pem;/)
    // The map refuses ".." and anything but [a-z0-9.-]: no path outside live/.
    const [, pattern] = site.match(/"~(\^[^"]+)"\s+\$ssl_server_name;/) ?? []
    const re = new RegExp(pattern)
    for (const ok of ['www.khachsan.vn', 'khach-san.com.vn']) expect(re.test(ok)).toBe(true)
    for (const bad of ['../../etc/x', 'a..b.vn', 'x/y.vn', 'WWW.X.VN', 'localhost', '']) expect(re.test(bad)).toBe(false)
    expect(site).toMatch(/default\s+"none";/)
  })

  it('never routes the internal endpoints and passes the real client IP', () => {
    expect(site).toMatch(/location \/api\/internal\/ \{\s*return 404;/)
    expect(site).toMatch(/proxy_set_header X-Real-IP\s+\$remote_addr;/)
    expect(site).toContain('include /etc/nginx/conf.d/security-headers-site.inc;')
  })

  it("sends HSTS without includeSubDomains: the hotel's other subdomains are not ours", () => {
    const directives = headers.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')
    expect(directives).toMatch(/Strict-Transport-Security "max-age=\d+"/)
    expect(directives).not.toMatch(/includeSubDomains/)
  })

  it('keeps port 80 the default for every host, so Let\'s Encrypt reaches the challenge', () => {
    const http = conf('app.conf')
    expect(http).toMatch(/listen 80 default_server;/)
    expect(http).toMatch(/location \^~ \/\.well-known\/acme-challenge\//)
  })
})
