'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { guestEmailKey } from '../../dat-phong/BookingForm'

/** "Chép mã" for the booking code. */
export function CopyCode({ code }: { code: string }) {
  const t = useTranslations('site.booking')
  const [done, setDone] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(code).then(() => setDone(true), () => {})}
      className="h-11 flex-none border border-line bg-panel px-5 text-[14px] font-medium text-fg hover:border-ink"
    >
      {done ? t('common.copied') : t('done.copyCode')}
    </button>
  )
}

/**
 * "Đã gửi email xác nhận tới …": the address the guest typed on this
 * device, kept in sessionStorage by the booking form; the page itself never
 * shows guest data (it is the link in emails).
 */
export function EmailSentLine({ token }: { token: string }) {
  const t = useTranslations('site.booking.done')
  const [email, setEmail] = React.useState<string | null>(null)
  React.useEffect(() => {
    try {
      setEmail(sessionStorage.getItem(guestEmailKey(token)))
    } catch {
      // Storage blocked: the line without the address.
    }
  }, [token])
  return (
    <p className="flex items-center gap-3 text-[14px] text-fg/80">
      <span aria-hidden className="h-2 w-2 flex-none bg-acc" />
      <span>{email ? t.rich('emailSent', { email, b: (c) => <b className="font-semibold text-fg">{c}</b> }) : t('emailSentAnon')}</span>
    </p>
  )
}
