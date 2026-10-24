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
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { SITE_LOCALE_HEADER } from '@/i18n/locales'
import Providers from '@/components/providers'
import { ApiErrorsProvider } from '@/components/i18n/api-errors-provider'

/**
 * The default title and description, for pages without their own (the
 * dashboard's), in the visitor's language: Digistay's own home texts.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.meta')
  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    icons: {
      icon: [
        { url: '/icon.png', type: 'image/png' },
        { url: '/favicon.ico', sizes: 'any' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },
  }
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
  // The API's messages in English (src/lib/i18n/api-errors.ts), for English pages only.
  const apiErrors = locale === 'en' ? (await import('@/lib/i18n/api-errors.en.json')).default : undefined
  return (
    <html lang={locale}>
      <head>
        {/* The older pages' fonts from Google. Not on a hotel's site: it sets its own
            fonts ([subdomain]/layout.tsx) and uses neither, and these two stylesheets
            held up a guest's first paint on a phone (Lighthouse: render-blocking). */}
        {!hotelSite && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
          </>
        )}
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
          <ApiErrorsProvider dictionary={apiErrors}>
            <Providers>{children}</Providers>
          </ApiErrorsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
