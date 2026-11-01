'use client'

import * as React from 'react'
import { Phone, CalendarCheck } from 'lucide-react'

export function StickyMobileBookingBar({
  phone,
  bookingLink = '#rooms',
  primaryColor = '#3B82F6',
  startingPrice,
}: {
  phone?: string | null
  bookingLink?: string
  primaryColor?: string
  startingPrice?: string | null
}) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 250) {
        setVisible(true)
      } else {
        setVisible(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!visible) return null

  return (
    <aside
      aria-label="Đặt phòng nhanh"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t px-4 py-2.5 shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="min-w-0">
        <div className="text-[11px] text-muted">Ưu đãi chiến dịch</div>
        <div className="text-xs font-bold text-fg truncate">
          {startingPrice ? (
            <>
              Chỉ từ <span className="text-emerald-600">{startingPrice}</span>
            </>
          ) : (
            'Giá tốt nhất khi đặt trực tiếp'
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {phone && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
            className="p-2.5 rounded-full border bg-muted/60 text-muted-fg hover:text-fg"
            title="Gọi hotline tư vấn"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        <a
          href={bookingLink}
          className="px-5 py-2.5 rounded-full text-white font-semibold text-xs shadow flex items-center gap-1.5"
          style={{ backgroundColor: primaryColor }}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          Đặt ngay
        </a>
      </div>
    </aside>
  )
}

