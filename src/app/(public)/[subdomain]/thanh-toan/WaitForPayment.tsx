'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const EVERY_MS = 4_000
const FOR_MS = 2 * 60 * 1000

/** Reloads the return page while the webhook is on its way, for two minutes at most. */
export function WaitForPayment() {
  const router = useRouter()
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
      {waiting ? 'Trang tự cập nhật…' : 'Chưa thấy tiền về. Khách sạn sẽ liên hệ khi nhận được.'}
    </p>
  )
}
