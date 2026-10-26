import { useTranslations } from 'next-intl'
import { Container } from '../site-ui'

/** "© 2026 hotel · address · phone" and "Vận hành bởi Digistay". */
export function BookingFooter({ property }: { property: { name: string; address: string | null; phone: string | null } }) {
  const t = useTranslations('site.blocks.footer')
  return (
    <footer className="mt-20 border-t border-line lg:mt-28">
      <Container className="flex flex-col gap-3 py-7 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{[`© ${new Date().getFullYear()} ${property.name}`, property.address, property.phone].filter(Boolean).join(' · ')}</p>
        <p className="flex items-center gap-2">
          {t('poweredBy')}
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" aria-hidden="true" />
            Digistay
          </span>
        </p>
      </Container>
    </footer>
  )
}
