/**
 * The nginx config the deploy renders (docker/nginx/conf.d): who may name
 * the client's IP. getClientIp() trusts X-Real-IP, which nginx sets to
 * $remote_addr, so a wrong set_real_ip_from would let anyone choose the IP
 * that rate limits and lockouts count. Checked for real (nginx in Docker,
 * spoofed vs Cloudflare-sourced header) when cloudflare-real-ip.inc was added.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'

const DIR = new URL('../docker/nginx/conf.d/', import.meta.url)
const conf = (name) => readFileSync(new URL(name, DIR), 'utf8')
const inc = conf('cloudflare-real-ip.inc')
const ranges = [...inc.matchAll(/^set_real_ip_from\s+(\S+);$/gm)].map((m) => m[1])

/** app-secure.conf as docker/deploy.sh renders it (envsubst '$DOMAIN'). */
const secure = conf('app-secure.conf.template').replaceAll('${DOMAIN}', 'digistay.vn')

/** The top-level `server { ... }` blocks of a config, comments dropped. */
function serverBlocks(text) {
  const code = text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')
  const blocks = []
  for (const m of code.matchAll(/^server\s*\{/gm)) {
    let depth = 0
    for (let i = m.index; i < code.length; i++) {
      if (code[i] === '{') depth++
      else if (code[i] === '}' && --depth === 0) {
        blocks.push(code.slice(m.index, i + 1))
        break
      }
    }
  }
  return blocks
}
const byName = (text, name) => serverBlocks(text).filter((b) => b.match(/server_name ([^;]+);/)?.[1].split(/\s+/).includes(name))

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

  it('is included in every server block, and only the include names who may set the IP', () => {
    const files = { 'app-secure.conf': secure, 'app.conf': conf('app.conf'), 'custom-domains.conf': conf('custom-domains.conf') }
    for (const [name, text] of Object.entries(files)) {
      const blocks = serverBlocks(text)
      expect(blocks.length, name).toBeGreaterThan(0)
      for (const block of blocks) {
        expect(block, name).toContain('include /etc/nginx/conf.d/cloudflare-real-ip.inc;')
        // X-Real-IP stays $remote_addr: the real-ip module is what rewrites it.
        for (const line of block.match(/proxy_set_header X-Real-IP[^;]*;/g) ?? []) {
          expect(line, name).toMatch(/proxy_set_header X-Real-IP\s+\$remote_addr;/)
        }
      }
    }
    // A set_real_ip_from anywhere else (a server block, a new file) would
    // escape the checks above on the ranges.
    for (const name of readdirSync(DIR).filter((f) => f !== 'cloudflare-real-ip.inc')) {
      const code = conf(name).split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')
      expect(code, name).not.toMatch(/set_real_ip_from|real_ip_header|real_ip_recursive/)
    }
  })
})

describe('HTTPS for digistay.vn and its hotel subdomains (app-secure.conf.template)', () => {
  it("keeps the apex and www on the Let's Encrypt certificate, without the subdomains", () => {
    const [apex] = byName(secure, 'digistay.vn')
    expect(apex).toMatch(/server_name digistay\.vn www\.digistay\.vn;/)
    expect(apex).toMatch(/ssl_certificate\s+\/etc\/letsencrypt\/live\/digistay\.vn\/fullchain\.pem;/)
  })

  it('serves *.digistay.vn with the Cloudflare Origin CA certificate, read per handshake', () => {
    const subdomains = byName(secure, '*.digistay.vn')
    expect(subdomains).toHaveLength(1)
    const [block] = subdomains
    expect(block).toMatch(/listen 443 ssl;/)
    // A variable in the path: a missing certificate cannot stop nginx or fail a deploy's `nginx -t`.
    expect(block).toMatch(/ssl_certificate\s+\/etc\/letsencrypt\/cloudflare-origin\/\$digistay_origin_cert\/cert\.pem;/)
    expect(block).toMatch(/ssl_certificate_key\s+\/etc\/letsencrypt\/cloudflare-origin\/\$digistay_origin_cert\/key\.pem;/)
    expect(secure).toMatch(/map \$ssl_server_name \$digistay_origin_cert \{\s*default digistay\.vn;\s*\}/)
    expect(block).toMatch(/location \/api\/internal\/ \{\s*return 404;/)
    expect(block).toContain('include /etc/nginx/conf.d/security-headers.inc;')
    expect(block).toMatch(/client_max_body_size 12m;/)
  })

  it('leaves every other HTTPS name to the default server (hotels\' own domains)', () => {
    const names = [secure, conf('custom-domains.conf')].flatMap((t) => serverBlocks(t)).map((b) => b.match(/server_name ([^;]+);/)?.[1])
    expect(names.sort()).toEqual(['*.digistay.vn', '_', 'digistay.vn www.digistay.vn'])
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

describe('certificates nginx reads per handshake (a variable in the path)', () => {
  const certbot = (name) => readFileSync(new URL(`../docker/certbot/${name}`, import.meta.url), 'utf8')

  it("are opened to nginx's workers after every issuance and renewal, keys to its group only", () => {
    // Read by the workers (user nginx, gid 101), not the root master: certbot's
    // root-only live/ and 0600 keys failed every such handshake (checked in Docker).
    for (const [name, text] of [['custom-domains.conf', conf('custom-domains.conf')], ['app-secure.conf', secure]]) {
      expect(text, name).toMatch(/ssl_certificate_key\s+\S*\$\w+/)
    }
    for (const script of ['custom-domains.sh', 'renew.sh']) {
      expect(certbot(script), script).toContain('bash "$(dirname "${BASH_SOURCE[0]}")/nginx-readable.sh"')
    }
    const fix = certbot('nginx-readable.sh')
    expect(fix).toMatch(/NGINX_GID=101/)
    expect(fix).toContain('for dir in live archive cloudflare-origin; do')
    expect(fix).toMatch(/-name "privkey\*\.pem" -o -name "key\.pem"/)
    expect(fix).toMatch(/chgrp "\$NGINX_GID" \{\} \+ -exec chmod 0640 \{\} \+/)
  })
})
