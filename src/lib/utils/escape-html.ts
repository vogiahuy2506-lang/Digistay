/**
 * Escapes text for HTML element content and quoted attribute values. Use it
 * for every value in HTML built as a string (document.write, emails): guest
 * names, phones and emails come from the public booking form.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
