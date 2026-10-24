/**
 * Structured data (schema.org JSON-LD) inside <script type="application/ld+json">.
 *
 * The script's text is raw: the browser ends it at the first "</script",
 * whatever JSON quoting says, so a hotel named "</script><script>…" would
 * run its own code. JSON.stringify leaves "<" alone; this writes it, and the
 * other characters that matter in HTML or old JavaScript parsers, as \u
 * escapes, which JSON reads back as the same text.
 */

const UNSAFE: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

/** JSON for a <script type="application/ld+json">, safe to put in the page as is. */
export function serializeJsonLd(data: unknown): string {
  return (JSON.stringify(data) ?? 'null').replace(/[<>&\u2028\u2029]/g, (c) => UNSAFE[c])
}
