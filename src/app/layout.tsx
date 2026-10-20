import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google'
import './globals.css'
import Providers from '@/components/providers'

// Redesign fonts, self-hosted by next/font. They only set CSS variables:
// pages opt in through font-sans / font-serif / font-mono (tailwind.config.ts).
const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter', display: 'swap' })
const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-playfair',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DigiStay - Nền Tảng No-Code Xây Dựng Kênh Bán Phòng Độc Quyền',
  description: 'DigiStay là nền tảng SaaS No-Code toàn diện: Tự tạo website boutique hotel chỉ trong 15 phút, tích hợp Booking Engine trực tiếp, đồng bộ phòng tức thì và cổng VietQR Napas247.',
  keywords: ['booking engine', 'hotel website', 'boutique hotel', 'homestay management', 'VietQR', 'Napas247', 'No-Code'],
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed-variant">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
