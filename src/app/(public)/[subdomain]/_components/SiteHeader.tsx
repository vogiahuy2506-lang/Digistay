import { Menu, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LanguageSwitch, SiteLink, SiteThemeToggle } from './site-base'
import { Container, propertyTypeLabel } from './site-ui'

export type SiteSectionId = 'rooms' | 'amenities' | 'gallery' | 'services' | 'menu' | 'map' | 'contact'

export interface SiteSection {
  id: SiteSectionId
}

interface Props {
  property: { name: string; type: string; city: string; phone: string | null }
  /** Sections of the home page shown in the menu (labels from site.sections). */
  sections: SiteSection[]
  /** On the home page the menu scrolls; elsewhere it links back to it. */
  onHome?: boolean
}

/** Hotel website header (redesign 3a): wordmark, section menu, phone, "Đặt phòng". */
export function SiteHeader({ property, sections, onHome = true }: Props) {
  const t = useTranslations('site')
  const sectionPath = (id: string) => (onHome ? `#${id}` : `/#${id}`)
  const bookPath = onHome ? '#booking' : '/search'
  const linkClass = 'text-small text-fg hover:text-acc transition-colors duration-160 focus:outline-none focus-visible:text-acc'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/95 backdrop-blur">
      <Container className="flex h-16 sm:h-20 items-center gap-3 sm:gap-6">
        {/* Phones: the name on up to two lines and the controls tighter; it
            used to be cut to "Khách sạn…" beside EN, "Đặt phòng" and the menu. */}
        <SiteLink path="/" className="min-w-0 shrink focus:outline-none focus-visible:underline">
          <span className="block font-site text-[17px] leading-[1.15] sm:text-[24px] text-fg text-balance line-clamp-2 [overflow-wrap:anywhere]">{property.name}</span>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-muted truncate">
            {propertyTypeLabel(property.type, t)} · {property.city}
          </span>
        </SiteLink>

        {sections.length > 0 && (
          <nav aria-label={t('nav.sections')} className="hidden lg:flex flex-1 justify-center gap-8">
            {sections.map((s) =>
              onHome ? (
                <a key={s.id} href={sectionPath(s.id)} className={linkClass}>
                  {t(`sections.${s.id}`)}
                </a>
              ) : (
                <SiteLink key={s.id} path={sectionPath(s.id)} className={linkClass}>
                  {t(`sections.${s.id}`)}
                </SiteLink>
              )
            )}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-5 shrink-0">
          <div className="flex items-center">
            {/* Below lg, where the section menu is, the toggle sits in that menu: the hotel's name needs the room. */}
            <SiteThemeToggle
              className={`${sections.length > 0 ? 'hidden lg:flex' : ''} h-11 w-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc`}
            />
            <LanguageSwitch className="inline-flex h-11 min-w-11 items-center justify-center rounded-ctl px-2 text-small font-medium text-fg hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc" />
          </div>
          {property.phone && (
            <a href={`tel:${property.phone.replace(/[^\d+]/g, '')}`} className={`hidden md:inline-flex items-center gap-2 ${linkClass}`}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              {property.phone}
            </a>
          )}
          {onHome ? (
            <a href={bookPath} className="inline-flex h-11 items-center whitespace-nowrap rounded-ctl bg-ink px-3 sm:px-5 text-small font-medium text-on-ink hover:bg-ink/90 transition-colors">
              {t('nav.book')}
            </a>
          ) : (
            <SiteLink path={bookPath} className="inline-flex h-11 items-center whitespace-nowrap rounded-ctl bg-ink px-3 sm:px-5 text-small font-medium text-on-ink hover:bg-ink/90 transition-colors">
              {t('nav.book')}
            </SiteLink>
          )}
          {sections.length > 0 && (
            <details className="relative lg:hidden">
              <summary
                aria-label={t('nav.openMenu')}
                className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-ctl text-fg hover:bg-fg/5 [&::-webkit-details-marker]:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </summary>
              <nav aria-label={t('nav.sections')} className="absolute right-0 top-12 z-50 min-w-[200px] border border-line bg-raised py-2 shadow-lift">
                {sections.map((s) =>
                  onHome ? (
                    <a key={s.id} href={sectionPath(s.id)} className="block px-4 py-3 text-body text-fg hover:bg-fg/5">
                      {t(`sections.${s.id}`)}
                    </a>
                  ) : (
                    <SiteLink key={s.id} path={sectionPath(s.id)} className="block px-4 py-3 text-body text-fg hover:bg-fg/5">
                      {t(`sections.${s.id}`)}
                    </SiteLink>
                  )
                )}
                <div className="mt-2 border-t border-line pt-2">
                  <SiteThemeToggle withLabel className="px-4 py-3 text-body focus:outline-none focus-visible:bg-fg/5" />
                </div>
              </nav>
            </details>
          )}
        </div>
      </Container>
    </header>
  )
}
