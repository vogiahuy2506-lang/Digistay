import { Menu, Phone } from 'lucide-react'
import { SiteLink } from './site-base'
import { Container, propertyTypeLabel } from './site-ui'

export interface SiteSection {
  id: string
  label: string
}

interface Props {
  property: { name: string; type: string; city: string; phone: string | null }
  /** Sections of the home page shown in the menu ("Phòng", "Tiện ích"...). */
  sections: SiteSection[]
  /** On the home page the menu scrolls; elsewhere it links back to it. */
  onHome?: boolean
}

/** Hotel website header (redesign 3a): wordmark, section menu, phone, "Đặt phòng". */
export function SiteHeader({ property, sections, onHome = true }: Props) {
  const sectionPath = (id: string) => (onHome ? `#${id}` : `/#${id}`)
  const bookPath = onHome ? '#booking' : '/search'
  const linkClass = 'text-small text-fg hover:text-acc transition-colors duration-160 focus:outline-none focus-visible:text-acc'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/95 backdrop-blur">
      <Container className="flex h-16 sm:h-20 items-center gap-6">
        <SiteLink path="/" className="min-w-0 shrink focus:outline-none focus-visible:underline">
          <span className="block font-site text-[20px] sm:text-[24px] leading-tight text-fg truncate">{property.name}</span>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-muted truncate">
            {propertyTypeLabel(property.type)} · {property.city}
          </span>
        </SiteLink>

        {sections.length > 0 && (
          <nav aria-label="Các mục" className="hidden lg:flex flex-1 justify-center gap-8">
            {sections.map((s) =>
              onHome ? (
                <a key={s.id} href={sectionPath(s.id)} className={linkClass}>
                  {s.label}
                </a>
              ) : (
                <SiteLink key={s.id} path={sectionPath(s.id)} className={linkClass}>
                  {s.label}
                </SiteLink>
              )
            )}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3 sm:gap-5 shrink-0">
          {property.phone && (
            <a href={`tel:${property.phone.replace(/[^\d+]/g, '')}`} className={`hidden md:inline-flex items-center gap-2 ${linkClass}`}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              {property.phone}
            </a>
          )}
          {onHome ? (
            <a href={bookPath} className="inline-flex h-11 items-center rounded-ctl bg-ink px-5 text-small font-medium text-on-ink hover:bg-ink/90 transition-colors">
              Đặt phòng
            </a>
          ) : (
            <SiteLink path={bookPath} className="inline-flex h-11 items-center rounded-ctl bg-ink px-5 text-small font-medium text-on-ink hover:bg-ink/90 transition-colors">
              Đặt phòng
            </SiteLink>
          )}
          {sections.length > 0 && (
            <details className="relative lg:hidden">
              <summary
                aria-label="Mở menu"
                className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-ctl text-fg hover:bg-fg/5 [&::-webkit-details-marker]:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </summary>
              <nav aria-label="Các mục" className="absolute right-0 top-12 z-50 min-w-[200px] border border-line bg-raised py-2 shadow-lift">
                {sections.map((s) =>
                  onHome ? (
                    <a key={s.id} href={sectionPath(s.id)} className="block px-4 py-3 text-body text-fg hover:bg-fg/5">
                      {s.label}
                    </a>
                  ) : (
                    <SiteLink key={s.id} path={sectionPath(s.id)} className="block px-4 py-3 text-body text-fg hover:bg-fg/5">
                      {s.label}
                    </SiteLink>
                  )
                )}
              </nav>
            </details>
          )}
        </div>
      </Container>
    </header>
  )
}
