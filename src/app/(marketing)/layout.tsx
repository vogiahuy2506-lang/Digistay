import type { Metadata } from 'next'
import '@/app/globals.css'
import { GlassNav } from '@/components/marketing/GlassNav'
import { GlassFooter } from '@/components/marketing/GlassFooter'
import { GradientBackground } from '@/components/marketing/GradientBackground'

export const metadata: Metadata = {
  title: 'DigiStay - Nền Tảng Quản Lý Khách Sạn Boutique',
  description: 'Xây dựng kênh bán phòng độc quyền với 0% phí sàn. Quản lý đặt phòng, hóa đơn, thanh toán tất cả trong một nền tảng.',
  keywords: ['quản lý khách sạn', 'booking system', 'hotel management', 'boutique hotel', 'property management'],
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <GradientBackground />
      <GlassNav />
      <main className="relative z-10">
        {children}
      </main>
      <GlassFooter />
    </div>
  )
}
