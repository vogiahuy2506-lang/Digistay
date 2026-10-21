import { blockText } from '@/lib/i18n/content'
import { getIcon } from '../icon-map'
import type { PublicAmenity, PublicBlock, PublicImage } from '../PropertySite'
import { Eyebrow, Section, SectionTitle } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'

interface Props {
  block: PublicBlock
  amenities: PublicAmenity[]
  images: PublicImage[]
}

/** Amenities (redesign 3a): a ruled list next to a large photo. */
export function AmenitiesBlock({ block, amenities, images }: Props) {
  const locale = useLocale()
  const t = useTranslations('site.blocks.amenities')
  const cfg = block.config || {}
  const title = blockText(cfg, locale, 'amenitiesTitle', 'title') ?? t('title')
  // The hero shows the first photos; take a later one when there is one.
  const photo = images[2] ?? images[1] ?? images[0]

  return (
    <Section id="amenities" className="bg-fg/[0.02]">
      <div className={photo ? 'grid gap-10 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-16' : ''}>
        <div>
          <Eyebrow>{t('eyebrow')}</Eyebrow>
          <SectionTitle>{title}</SectionTitle>
          {amenities.length === 0 ? (
            <p className="mt-8 text-body text-muted">{t('empty')}</p>
          ) : (
            <ul className={`mt-8 border-t border-line ${photo ? '' : 'sm:grid sm:grid-cols-2 sm:gap-x-10'}`}>
              {amenities.map((amenity) => {
                const Icon = getIcon(amenity.icon)
                return (
                  <li key={amenity.id} className="flex items-center gap-3 border-b border-line py-4 text-body text-fg">
                    <Icon className="h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
                    {amenity.name}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={photo.alt ?? title} loading="lazy" className="h-full min-h-[320px] w-full object-cover" />
        )}
      </div>
    </Section>
  )
}
