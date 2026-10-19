import type { Metadata } from 'next'
import '@/app/globals.css'
import { AuthNav } from '@/components/marketing/AuthNav'
import { AuthFooter } from '@/components/marketing/AuthFooter'

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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-terracotta-700 via-primary to-terracotta-600">
      {/* Background hotel image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80')",
        }}
      />
      
      {/* Background morph blobs - matching auth style */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-primary-fixed/40 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-terracotta-300/40 blur-3xl animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container/30 blur-3xl animate-pulse-slow animation-delay-4000" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <AuthNav />
        <main className="pt-24">
          {children}
        </main>
        <AuthFooter />
      </div>
    </div>
  )
}
