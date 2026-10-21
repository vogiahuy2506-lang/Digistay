/**
 * The contact form on Digistay's own site (/contact): the request is emailed
 * to the Digistay team through the outbox (src/lib/email/outbox.ts), so a
 * refused or unconfigured mail server delays it instead of losing it.
 *
 * Recipients: CONTACT_EMAILS (comma separated), otherwise ALERT_EMAILS.
 * With neither, nothing is stored and the form says it could not send,
 * rather than claiming the request was received.
 */
import { z } from 'zod'
import { queueEmail, sendAfterResponse } from '@/lib/email/outbox'
import { escapeHtml } from '@/lib/utils/escape-html'

export const CONTACT_TOPICS = ['sales', 'support', 'partnership'] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]

const TOPIC_LABELS: Record<ContactTopic, string> = {
  sales: 'Tư vấn',
  support: 'Hỗ trợ kỹ thuật',
  partnership: 'Hợp tác',
}

/** Same rules as the form (contact/ContactForm.tsx): a phone has 8 to 15 digits. */
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().max(200).email(),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => /^[\d\s+().-]*$/.test(v) && v.replace(/\D/g, '').length >= 8 && v.replace(/\D/g, '').length <= 15),
  hotel: z.string().trim().max(120).optional().default(''),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(5).max(4000),
})
export type ContactRequest = z.infer<typeof contactSchema>

export function contactRecipients(env: Record<string, string | undefined> = process.env): string[] {
  const list = env.CONTACT_EMAILS?.trim() ? env.CONTACT_EMAILS : env.ALERT_EMAILS
  return [...new Set((list ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))]
}

export function contactEmail(req: ContactRequest) {
  const subject = `Liên hệ mới (${TOPIC_LABELS[req.topic]}): ${req.name}${req.hotel ? ` - ${req.hotel}` : ''}`
  const text = [
    `Nhu cầu: ${TOPIC_LABELS[req.topic]}`,
    `Họ tên: ${req.name}`,
    `Email: ${req.email}`,
    `Điện thoại: ${req.phone}`,
    ...(req.hotel ? [`Khách sạn: ${req.hotel}`] : []),
    '',
    req.message,
  ].join('\n')
  // Every field comes from a public form: escape them for the HTML part.
  const html = escapeHtml(text).replace(/\n/g, '<br/>')
  return { subject, text, html }
}

/** Queues one email per recipient and sends them after the response; false when nobody is configured. */
export async function queueContactRequest(req: ContactRequest, recipients = contactRecipients()): Promise<boolean> {
  if (recipients.length === 0) return false
  const message = contactEmail(req)
  const ids: string[] = []
  for (const email of recipients) ids.push(await queueEmail('contact_request', { to: { email }, ...message }))
  sendAfterResponse(ids)
  return true
}
