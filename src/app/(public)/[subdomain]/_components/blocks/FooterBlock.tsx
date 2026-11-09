import type { PublicBlock, PublicProperty } from '../PropertySite'
import type { SiteSection } from '../SiteHeader'
import { Container } from '../site-ui'
import { SiteLink } from '../site-base'
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
              {(property.hotline || property.phone) && (
                <li>
                  <a href={`tel:${(property.hotline || property.phone)!.replace(/[^\d+]/g, '')}`} className="hover:text-acc">
                    {property.hotline ? `Hotline: ${property.hotline}` : property.phone}
                  </a>
                </li>
              )}
              {property.receptionPhone && (
                <li>
                  <a href={`tel:${property.receptionPhone.replace(/[^\d+]/g, '')}`} className="hover:text-acc">
                    Lễ tân: {property.receptionPhone}
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
              {(property.zalo || property.whatsapp || property.telegram || property.facebook) && (
                <li className="flex flex-wrap gap-3 pt-1">
                  {property.zalo && (
                    <a
                      href={property.zalo.startsWith('http') ? property.zalo : `https://zalo.me/${property.zalo.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-acc hover:underline"
                    >
                      Zalo
                    </a>
                  )}
                  {property.whatsapp && (
                    <a
                      href={property.whatsapp.startsWith('http') ? property.whatsapp : `https://wa.me/${property.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-acc hover:underline"
                    >
                      WhatsApp
                    </a>
                  )}
                  {property.telegram && (
                    <a
                      href={property.telegram.startsWith('http') ? property.telegram : `https://t.me/${property.telegram.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-acc hover:underline"
                    >
                      Telegram
                    </a>
                  )}
                  {property.facebook && (
                    <a
                      href={property.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-acc hover:underline"
                    >
                      Facebook
                    </a>
                  )}
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
                <li>
                  <SiteLink path="/blog" className="hover:text-acc">
                    Blog & Tin tức
                  </SiteLink>
                </li>
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
