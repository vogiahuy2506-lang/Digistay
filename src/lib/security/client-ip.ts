/**
 * The client IP for rate limits.
 *
 * Only `X-Real-IP` is trusted: nginx (docker/nginx/conf.d) sets it to
 * $remote_addr, overwriting whatever the client sent, and the app container
 * is reachable only through nginx. `X-Forwarded-For` is never read: nginx
 * appends to it, so its first entries are client-controlled and would let an
 * attacker pick a fresh "IP" per request.
 *
 * Behind Cloudflare's proxy (hotel subdomains) $remote_addr would be
 * Cloudflare's address. nginx's real-ip module fixes that before X-Real-IP
 * is set (docker/nginx/conf.d/cloudflare-real-ip.inc, in every server
 * block): it takes CF-Connecting-IP only from Cloudflare's published ranges.
 * So CF-Connecting-IP is never read here either: a request sent straight to
 * the server, around Cloudflare, could put anything in it.
 */
type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined

const IP_CHARS = /^[0-9a-fA-F:.]{2,45}$/

export function getClientIp(headers: HeaderSource): string {
  let value: string | string[] | null | undefined
  if (!headers) value = undefined
  else if (typeof (headers as Headers).get === 'function') value = (headers as Headers).get('x-real-ip')
  else value = (headers as Record<string, string | string[] | undefined>)['x-real-ip']

  const ip = (Array.isArray(value) ? value[0] : value)?.trim()
  return ip && IP_CHARS.test(ip) ? ip : 'unknown'
}
