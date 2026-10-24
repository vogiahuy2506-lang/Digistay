import type { Metadata } from 'next'
// Redesign fonts, self-hosted from npm; they only set CSS variables
// (src/styles/fonts.css explains why not next/font/google).
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/playfair-display/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '@/styles/fonts.css'
import './globals.css'
import { NextIntlClientProvider } from 'next-intl'
import { headers } from 'next/headers'
import { getLocale, getMessages } from 'next-intl/server'
import { SITE_LOCALE_HEADER } from '@/i18n/locales'
import Providers from '@/components/providers'

export const metadata: Metadata = {
  title: 'DigiStay - Nền Tảng No-Code Xây Dựng Kênh Bán Phòng Độc Quyền',
  description: 'DigiStay là nền tảng SaaS No-Code toàn diện: Tự tạo website boutique hotel chỉ trong 15 phút, tích hợp Booking Engine trực tiếp, đồng bộ phòng tức thì và cổng VietQR Napas247.',
  keywords: ['booking engine', 'hotel website', 'boutique hotel', 'homestay management', 'VietQR', 'Napas247', 'No-Code'],
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  // A hotel's website (the middleware marks it) only needs its own messages; Digistay's
  // pages and the dashboard get theirs too. Guests on phones download the site's alone.
  const hotelSite = (await headers()).has(SITE_LOCALE_HEADER)
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed-variant">
        {/* The client components' messages. One provider only: a second one nested in the
            hotel site's layout made its pages fail to hydrate now and then (React #418) in
            production builds. Add an area's namespace here when it needs one. */}
        <NextIntlClientProvider
          messages={
            hotelSite
              ? { common: messages.common, site: messages.site }
              : {
                  common: messages.common,
                  marketing: { contact: messages.marketing.contact },
                  auth: messages.auth,
                  dash: messages.dash,
                  workspaces: messages.workspaces,
                  workspaceHome: messages.workspaceHome,
                }
          }
        >
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
