import type { Metadata } from 'next'
// Redesign fonts, self-hosted from npm; they only set CSS variables
// (src/styles/fonts.css explains why not next/font/google).
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/playfair-display/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '@/styles/fonts.css'
import './globals.css'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import Providers from '@/components/providers'

export const metadata: Metadata = {
  title: 'DigiStay - Nền Tảng No-Code Xây Dựng Kênh Bán Phòng Độc Quyền',
  description: 'DigiStay là nền tảng SaaS No-Code toàn diện: Tự tạo website boutique hotel chỉ trong 15 phút, tích hợp Booking Engine trực tiếp, đồng bộ phòng tức thì và cổng VietQR Napas247.',
  keywords: ['booking engine', 'hotel website', 'boutique hotel', 'homestay management', 'VietQR', 'Napas247', 'No-Code'],
  icons: {
    icon: '/favicon.ico',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed-variant">
        {/* Only the shared messages here; each area adds its own (e.g. the hotel site's layout). */}
        <NextIntlClientProvider messages={{ common: messages.common }}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
