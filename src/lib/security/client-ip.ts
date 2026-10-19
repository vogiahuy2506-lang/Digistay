/**
 * The client IP for rate limits.
 *
 * Only `X-Real-IP` is trusted: nginx (docker/nginx/conf.d) sets it to
 * $remote_addr, overwriting whatever the client sent, and the app container
 * is reachable only through nginx. `X-Forwarded-For` is never read: nginx
 * appends to it, so its first entries are client-controlled and would let an
 * attacker pick a fresh "IP" per request.
 *
 * If a CDN such as Cloudflare is ever put in front, $remote_addr becomes the
 * CDN's address: configure nginx's real_ip module first.
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
