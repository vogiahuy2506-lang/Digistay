import { formatVnd } from '@/lib/bookings/display'
import type { PublicBlock, PublicService } from '../PropertySite'
import { Section, SectionHeader, cfgText } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'
import type { SiteT } from '../site-ui'

interface Props {
  block: PublicBlock
  services: PublicService[]
}

export function ServicesBlock({ block, services }: Props) {
  const t = useTranslations('site')
  const locale = useLocale()
  const cfg = block.config || {}
  const title = cfgText(cfg, 'servicesTitle', 'title') ?? t('blocks.services.title')

  return (
    <Section id="services">
      <SectionHeader eyebrow={t('blocks.services.eyebrow')} title={title} aside={services.length > 0 ? t('blocks.services.aside') : undefined} />
      {services.length === 0 ? (
        <p className="text-body text-muted">{t('blocks.services.empty')}</p>
      ) : (
        <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.id} className="flex items-start justify-between gap-4 border-b border-line py-5">
              <div className="min-w-0">
                <h3 className="text-body font-medium text-fg">{service.name}</h3>
                {service.description && <p className="mt-1 text-small text-muted">{service.description}</p>}
              </div>
              <p className="shrink-0 text-right text-body font-semibold tabular-nums text-fg">
                {service.price > 0 ? formatVnd(service.price, locale) : t('units.free')}
                {service.price > 0 && <span className="block text-xs font-normal text-muted">{priceTypeLabel(service.priceType, service.perPerson, t)}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/** "/đêm", "/người", "/đêm /người"; never "/người /người" as before. */
function priceTypeLabel(type: string, perPerson: boolean, t: SiteT): string {
  const unit = type === 'PER_NIGHT' ? t('units.perNight') : type === 'PER_PERSON' ? t('units.perPerson') : t('units.once')
  return perPerson && type !== 'PER_PERSON' ? `${unit} ${t('units.perPerson')}` : unit
}
