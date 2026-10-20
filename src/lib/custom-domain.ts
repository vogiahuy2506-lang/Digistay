/**
 * A hotel's own domain (www.khachsan.vn) for its property site: which
 * hostnames may be attached, and the two DNS checks before one is.
 *
 * 1. Routing: the hostname points at Digistay. A CNAME must name exactly
 *    this property's <subdomain>.<root>; without a CNAME (apex domains)
 *    every A record must be one of the root domain's addresses.
 * 2. Ownership: TXT `_digistay-verify.<host>` = `digistay-verify=<token>`,
 *    token = HMAC(key derived from NEXTAUTH_SECRET, workspace + host).
 *
 * Routing alone is not proof. A hotel that leaves Digistay and forgets its
 * DNS records keeps pointing at us, and anyone could then attach its domain
 * (Founder AI fixed exactly this, 2026-10). The TXT value depends on the
 * workspace, so only whoever controls the domain's DNS can produce it for
 * their own workspace.
 *
 * Node only (crypto, dns): used by route handlers, never by middleware.
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'crypto'
import { promises as dns } from 'dns'
import { isIP } from 'net'
import { domainToASCII } from 'url'
import { rootDomain } from '@/lib/subdomains'

export const OWNERSHIP_LABEL = '_digistay-verify'
export const OWNERSHIP_PREFIX = 'digistay-verify='

const HOSTNAME_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/
/** Letters (any script), digits, dots and hyphens: nothing domainToASCII would parse away. */
const HOSTNAME_CHARS = /^[\p{L}\p{M}\p{N}.-]+$/u

/**
 * The hostname in lowercase ASCII (punycode for Vietnamese names), or null
 * when it cannot be a hotel's own domain: malformed, an IP, a port or path,
 * localhost, or Digistay's root domain and its subdomains.
 */
export function normalizeHostname(input: unknown, root = rootDomain()): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim().toLowerCase().replace(/\.$/, '')
  if (!trimmed || trimmed.length > 253 || isIP(trimmed)) return null
  // domainToASCII reads its input as a URL host: "hotel.vn/x" or
  // "hotel.vn:8443" would come back as plain "hotel.vn".
  if (!HOSTNAME_CHARS.test(trimmed)) return null
  const host = domainToASCII(trimmed)
  if (!host || host.length > 253 || !HOSTNAME_RE.test(host)) return null
  if (host === root || host.endsWith(`.${root}`)) return null
  if (host === 'localhost' || host.endsWith('.localhost')) return null
  return host
}

function ownershipKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return Buffer.from(hkdfSync('sha256', secret, '', 'digistay custom-domain ownership v1', 32))
}

/** 32 hex chars; the same for one workspace and hostname, different otherwise. */
export function ownershipToken(workspaceId: string, host: string): string {
  return createHmac('sha256', ownershipKey())
    .update(`custom-domain-verify:${workspaceId}:${host}`)
    .digest('hex')
    .slice(0, 32)
}

/** The TXT record the hotel adds at its DNS provider. */
export function ownershipRecord(workspaceId: string, host: string) {
  return { name: `${OWNERSHIP_LABEL}.${host}`, value: `${OWNERSHIP_PREFIX}${ownershipToken(workspaceId, host)}` }
}

/** The DNS lookups used here; tests replace them on this object. */
export const resolver = {
  resolveCname: (host: string) => dns.resolveCname(host),
  resolve4: (host: string) => dns.resolve4(host),
  resolveTxt: (host: string) => dns.resolveTxt(host),
}

/** "No such record" (retrying will not help) as opposed to a timeout or SERVFAIL. */
function isMissing(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === 'ENODATA' || code === 'ENOTFOUND'
}

const clean = (name: string) => name.trim().toLowerCase().replace(/\.$/, '')

export type RoutingCheck =
  | { ok: true; via: 'cname' | 'a' }
  | { ok: false; reason: 'not_found' | 'wrong_target' | 'transient'; found: string[] }

export async function checkRouting(host: string, expectedCname: string, root = rootDomain()): Promise<RoutingCheck> {
  try {
    const cnames = (await resolver.resolveCname(host)).map(clean)
    // Exactly this property: any *.digistay.vn would let one hotel claim a
    // domain that points at another hotel's site.
    if (cnames.includes(clean(expectedCname))) return { ok: true, via: 'cname' }
    return { ok: false, reason: 'wrong_target', found: cnames }
  } catch (error) {
    if (!isMissing(error)) return { ok: false, reason: 'transient', found: [] }
  }

  let addresses: string[]
  try {
    addresses = await resolver.resolve4(host)
  } catch (error) {
    return { ok: false, reason: isMissing(error) ? 'not_found' : 'transient', found: [] }
  }
  let ours: string[]
  try {
    ours = await resolver.resolve4(root)
  } catch {
    return { ok: false, reason: 'transient', found: addresses }
  }
  // Every address: one foreign A record would send part of the traffic elsewhere.
  if (addresses.length > 0 && addresses.every((ip) => ours.includes(ip))) return { ok: true, via: 'a' }
  return { ok: false, reason: 'wrong_target', found: addresses }
}

export type OwnershipCheck =
  | { ok: true }
  | { ok: false; reason: 'txt_missing' | 'txt_wrong' | 'transient'; found: string[] }

export async function checkOwnership(host: string, workspaceId: string): Promise<OwnershipCheck> {
  const expected = ownershipRecord(workspaceId, host)
  let records: string[][]
  try {
    records = await resolver.resolveTxt(expected.name)
  } catch (error) {
    return { ok: false, reason: isMissing(error) ? 'txt_missing' : 'transient', found: [] }
  }
  // A long TXT record arrives in chunks; people also paste the quotes.
  const found = records
    .map((chunks) => chunks.join('').trim().replace(/^"([\s\S]*)"$/, '$1').trim())
    .filter(Boolean)
  const want = Buffer.from(expected.value.toLowerCase())
  const matches = found.some((value) => {
    const got = Buffer.from(value.toLowerCase())
    return got.length === want.length && timingSafeEqual(got, want)
  })
  if (matches) return { ok: true }
  return { ok: false, reason: found.length > 0 ? 'txt_wrong' : 'txt_missing', found }
}
