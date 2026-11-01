'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'

export function LiveCountdown({
  endDate,
  title,
  subtitle,
  buttonText,
  buttonLink,
  primaryColor,
}: {
  endDate?: string
  title: string
  subtitle?: string
  buttonText?: string
  buttonLink?: string
  primaryColor?: string
}) {
  const [timeLeft, setTimeLeft] = React.useState({ days: 3, hours: 14, minutes: 28, seconds: 45 })

  React.useEffect(() => {
    const target = endDate ? new Date(endDate).getTime() : Date.now() + 3 * 24 * 3600 * 1000 + 14 * 3600 * 1000

    const update = () => {
      const now = Date.now()
      const diff = Math.max(0, target - now)
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeLeft({ days, hours, minutes, seconds })
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [endDate])

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="rounded-2xl p-6 sm:p-8 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent text-center space-y-4 shadow-sm">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-amber-500/20 text-amber-600">
        <Clock className="w-4 h-4 animate-pulse" />
        Flash Sale Có Hạn
      </div>

      <h2 className="text-xl sm:text-3xl font-bold text-fg leading-tight">{title}</h2>
      {subtitle && <p className="text-sm text-muted max-w-xl mx-auto">{subtitle}</p>}

      {/* Countdown Digits */}
      <div className="flex justify-center items-center gap-2 sm:gap-4 py-3 font-mono">
        <div className="bg-card px-3 sm:px-4 py-2.5 rounded-xl border shadow-xs min-w-[64px]">
          <div className="text-2xl sm:text-3xl font-extrabold text-fg">{pad(timeLeft.days)}</div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Ngày</div>
        </div>
        <span className="text-xl font-bold text-muted">:</span>
        <div className="bg-card px-3 sm:px-4 py-2.5 rounded-xl border shadow-xs min-w-[64px]">
          <div className="text-2xl sm:text-3xl font-extrabold text-fg">{pad(timeLeft.hours)}</div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Giờ</div>
        </div>
        <span className="text-xl font-bold text-muted">:</span>
        <div className="bg-card px-3 sm:px-4 py-2.5 rounded-xl border shadow-xs min-w-[64px]">
          <div className="text-2xl sm:text-3xl font-extrabold text-fg">{pad(timeLeft.minutes)}</div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Phút</div>
        </div>
        <span className="text-xl font-bold text-muted">:</span>
        <div className="bg-card px-3 sm:px-4 py-2.5 rounded-xl border shadow-xs min-w-[64px]">
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">{pad(timeLeft.seconds)}</div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Giây</div>
        </div>
      </div>

      {buttonText && (
        <div className="pt-2">
          <a
            href={buttonLink || '#rooms'}
            className="inline-flex items-center justify-center px-8 py-3 rounded-full text-white font-semibold text-sm shadow-md hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor || '#3B82F6' }}
          >
            {buttonText}
          </a>
        </div>
      )}
    </div>
  )
}

