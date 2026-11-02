'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

const EVERY_MS = 4_000
const FOR_MS = 2 * 60 * 1000

/** Reloads the return page while the webhook is on its way, for two minutes at most. */
export function WaitForPayment() {
  const router = useRouter()
  const t = useTranslations('site.paymentReturn')
  const [waiting, setWaiting] = useState(true)

  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started > FOR_MS) {
        clearInterval(timer)
        setWaiting(false)
        return
      }
      router.refresh()
    }, EVERY_MS)
    return () => clearInterval(timer)
  }, [router])

  return (
    <p className="text-small text-muted" aria-live="polite">
      {waiting ? t('waitingPoll') : t('waitingTimeout')}
    </p>
  )
}
