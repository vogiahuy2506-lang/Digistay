'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Asks for a PayOS link (POST /api/public/deposits/[token]) and goes to it. */
export function PayDepositButton({ token, amount }: { token: string; amount: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pay = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/public/deposits/${encodeURIComponent(token)}`, { method: 'POST' })
      const data = await res.json()
      if (data.success && data.data.checkoutUrl) {
        window.location.assign(data.data.checkoutUrl)
        return
      }
      if (data.success && data.data.paid) {
        router.refresh()
      } else {
        setError(data.error || 'Không tạo được link đặt cọc')
      }
    } catch {
      setError('Không kết nối được máy chủ')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="flex h-12 w-full items-center justify-center rounded-ctl bg-ink text-body font-medium text-on-ink hover:bg-ink/90 disabled:opacity-60"
      >
        {busy ? 'Đang mở PayOS…' : `Đặt cọc ${amount} qua PayOS`}
      </button>
      {error && <p className="text-small text-err text-center">{error}</p>}
    </div>
  )
}
