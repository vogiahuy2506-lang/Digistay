/**
 * Room numbers as the hotel types them (Hạng phòng → Danh sách phòng). No
 * database here: the room list form uses it in the browser too.
 */

/** How room numbers are kept: trimmed, upper case ("a101" and "A101" are one room). */
export const normalizeRoomNumber = (value: string) => value.trim().toUpperCase()

/** "101-105, 201, 202" → ["101", ..., "105", "201", "202"]; null when unreadable or over `max`. */
export function parseRoomNumbers(input: string, max = 200): string[] | null {
  const out: string[] = []
  for (const part of input.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^([A-Za-z]*)(\d+)\s*-\s*\1?(\d+)$/)
    if (range) {
      const [, prefix, from, to] = range
      const a = Number(from)
      const b = Number(to)
      if (b < a || b - a >= max) return null
      for (let n = a; n <= b; n++) out.push(normalizeRoomNumber(`${prefix}${String(n).padStart(from.length, '0')}`))
    } else if (/^[\p{L}\p{N}][\p{L}\p{N} .\-/]{0,19}$/u.test(part)) {
      out.push(normalizeRoomNumber(part))
    } else {
      return null
    }
    if (out.length > max) return null
  }
  return out.length ? [...new Set(out)] : null
}
