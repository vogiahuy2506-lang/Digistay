import { describe, it, expect } from 'vitest'
import { contactEmail, contactRecipients, contactSchema } from './contact'

const ok = { name: 'Nguyễn Thu Hà', email: 'thuha@maybien.vn', phone: '0912 345 678', hotel: 'Mây Biển', topic: 'sales', message: 'Hỏi gói cho 24 phòng.' }

describe('contact form', () => {
  it('accepts a complete request and trims it', () => {
    const parsed = contactSchema.parse({ ...ok, name: '  Hà  ' })
    expect(parsed.name).toBe('Hà')
  })

  it.each([
    ['no name', { name: ' ' }],
    ['a bad email', { email: 'thuha@maybien' }],
    ['a short phone', { phone: '0912 34' }],
    ['letters in the phone', { phone: '0912abc345678' }],
    ['an empty message', { message: 'hi' }],
    ['an unknown topic', { topic: 'spam' }],
  ])('refuses %s', (_, change) => {
    expect(contactSchema.safeParse({ ...ok, ...change }).success).toBe(false)
  })

  it('accepts international phone numbers', () => {
    expect(contactSchema.safeParse({ ...ok, phone: '+44 20 7946 0958' }).success).toBe(true)
  })

  it('sends to CONTACT_EMAILS, else ALERT_EMAILS, else nobody', () => {
    expect(contactRecipients({ CONTACT_EMAILS: 'Sales@x.vn, b@x.vn,', ALERT_EMAILS: 'ops@x.vn' })).toEqual(['sales@x.vn', 'b@x.vn'])
    expect(contactRecipients({ CONTACT_EMAILS: ' ', ALERT_EMAILS: 'ops@x.vn' })).toEqual(['ops@x.vn'])
    expect(contactRecipients({})).toEqual([])
  })

  it('escapes what the visitor typed in the HTML part', () => {
    const mail = contactEmail(contactSchema.parse({ ...ok, name: '<img src=x onerror=alert(1)>', message: 'a <b>b</b>' }))
    expect(mail.html).not.toContain('<img')
    expect(mail.html).toContain('&lt;img')
    expect(mail.text).toContain('<img src=x onerror=alert(1)>')
    expect(mail.subject).toContain('Tư vấn')
  })
})
