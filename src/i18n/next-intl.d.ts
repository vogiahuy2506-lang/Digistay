import type messages from '../../messages/vi.json'
import type dash from '../../messages/dash/vi'
import type { Locale } from './locales'

// Typed keys: t('site.nav.book') is checked against messages/vi.json (and
// t('dash.bookings.…') against messages/dash/vi/*.json); messages.test.ts
// keeps the English files in step with them.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: typeof messages & { dash: typeof dash }
  }
}
