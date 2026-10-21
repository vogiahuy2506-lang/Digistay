import type messages from '../../messages/vi.json'
import type { Locale } from './locales'

// Typed keys: t('site.nav.book') is checked against messages/vi.json, and
// messages.test.ts keeps messages/en.json in step with it.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: typeof messages
  }
}
