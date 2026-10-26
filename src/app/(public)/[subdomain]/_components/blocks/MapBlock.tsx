import { blockText } from '@/lib/i18n/content'
import type { PublicBlock, PublicProperty } from '../PropertySite'
import { Eyebrow, Section, SectionTitle, cfgText } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'
import { formatAddress } from '@/lib/vn-admin/address'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

const BUILDER_DEFAULT = 'hà nội, việt nam'

function coordinate(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : null
}

/** Location (redesign 3a): embedded map, the address, "Chỉ đường" and "Gọi". */
export function MapBlock({ block, property }: Props) {
  const t = useTranslations('site.blocks.map')
  const locale = useLocale()
  const cfg = block.config || {}
  // The builder's old default address, "Hà Nội, Việt Nam", is no choice of
  // the hotel's: the map showed the city, not the hotel. Its own address then.
  const typed = cfgText(cfg, 'mapAddress')
  const fullAddress =
    (typed && typed.trim().toLowerCase() !== BUILDER_DEFAULT ? typed : null) ??
    formatAddress(property, { country: true })
  // The default layout titles this block "Vị trí", which is already the eyebrow: show the address instead (3a).
  const custom = blockText(cfg, locale, 'title')
  const title =
    custom && custom.toLowerCase() !== 'vị trí' ? custom : formatAddress(property)
  const lat = coordinate(cfg.mapLat) ?? property.latitude
  const lng = coordinate(cfg.mapLng) ?? property.longitude
  const zoom = Math.min(20, Math.max(3, Number(cfg.mapZoom) || 15))

  const query = lat != null && lng != null ? `${lat},${lng}` : fullAddress
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}&hl=${locale}&z=${zoom}&output=embed`
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`

  return (
    <Section id="map">
      <Eyebrow>{t('eyebrow')}</Eyebrow>
      <SectionTitle className="max-w-3xl">{title}</SectionTitle>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-14">
        <iframe
          src={embedUrl}
          className="h-[320px] sm:h-[420px] w-full border border-line"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={t('mapTitle', { address: fullAddress })}
        />
        <div className="flex flex-col">
          <dl className="border-t border-line">
            <div className="flex justify-between gap-4 border-b border-line py-4">
              <dt className="text-body text-fg">{t('address')}</dt>
              <dd className="text-right text-small text-muted">{fullAddress}</dd>
            </div>
            {property.phone && (
              <div className="flex justify-between gap-4 border-b border-line py-4">
                <dt className="text-body text-fg">{t('phone')}</dt>
                <dd className="text-small text-muted tabular-nums">{property.phone}</dd>
              </div>
            )}
          </dl>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center rounded-ctl border border-fg px-5 text-small font-medium text-fg hover:bg-fg/5"
            >
              {t('directions')}
            </a>
            {property.phone && (
              <a href={`tel:${property.phone.replace(/[^\d+]/g, '')}`} className="text-small font-medium text-acc hover:underline">
                {t('call', { phone: property.phone })}
              </a>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}
