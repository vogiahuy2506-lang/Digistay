import type { PublicBlock, PublicProperty } from '../PropertySite'
import type { SiteSection } from '../SiteHeader'
import { Container } from '../site-ui'
import { useTranslations } from 'next-intl'
import { formatAddress } from '@/lib/vn-admin/address'

interface Props {
  block: PublicBlock
  property: PublicProperty
  sections?: SiteSection[]
}

/** Footer (redesign 3a). Digistay's own color appears only in "Vận hành bởi Digistay". */
export function FooterBlock({ property, sections = [] }: Props) {
  const t = useTranslations('site')
  const year = new Date().getFullYear()
  const address = formatAddress(property)

  return (
    <footer className="border-t border-line pt-14 pb-8">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-site text-[28px] leading-9 text-fg">{property.name}</p>
            <p className="mt-3 text-small text-muted">{address}</p>
          </div>
          <div>
            <p className="text-label uppercase text-muted">{t('blocks.footer.contact')}</p>
            <ul className="mt-4 space-y-2 text-small text-fg">
              {property.phone && (
                <li>
                  <a href={`tel:${property.phone.replace(/[^\d+]/g, '')}`} className="hover:text-acc">
                    {property.phone}
                  </a>
                </li>
              )}
              {property.email && (
                <li>
                  <a href={`mailto:${property.email}`} className="hover:text-acc break-all">
                    {property.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
          {sections.length > 0 && (
            <div>
              <p className="text-label uppercase text-muted">{t('blocks.footer.explore')}</p>
              <ul className="mt-4 space-y-2 text-small text-fg">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="hover:text-acc">
                      {t(`sections.${s.id}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {property.name}
          </p>
          <p className="flex items-center gap-2">
            {t('blocks.footer.poweredBy')}
            <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" aria-hidden="true" />
              Digistay
            </span>
          </p>
        </div>
      </Container>
    </footer>
  )
}
