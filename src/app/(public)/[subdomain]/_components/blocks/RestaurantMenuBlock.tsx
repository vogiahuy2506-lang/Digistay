import { blockText } from '@/lib/i18n/content'
import { formatVnd } from '@/lib/bookings/display'
import { groupMenuItems, isMenuImageUrl } from '@/lib/menu/menu'
import { resizedImage } from '@/lib/media/image-url'
import type { PublicBlock, PublicMenuItem } from '../PropertySite'
import { Section, SectionHeader } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'

interface Props {
  block: PublicBlock
  menuItems: PublicMenuItem[]
}

/**
 * The hotel's restaurant menu (dashboard "Thực đơn", src/lib/menu/menu.ts):
 * the dishes on sale in the hotel's groups, each with its price and photo.
 * Config: `menuTitle` (or `title`) and `menuNote` (or `contactNote`), e.g.
 * how to book a table; in English `config.en.<key>`. No dishes: nothing at
 * all, never a sample menu.
 */
export function RestaurantMenuBlock({ block, menuItems }: Props) {
  const t = useTranslations('site')
  const locale = useLocale()
  if (menuItems.length === 0) return null

  const cfg = block.config || {}
  const title = blockText(cfg, locale, 'menuTitle', 'title') ?? t('blocks.menu.title')
  const note = blockText(cfg, locale, 'menuNote', 'contactNote')
  const groups = groupMenuItems(menuItems)
  // Group headings only when the hotel sorted its dishes into groups.
  const grouped = groups.some((g) => g.category)
  const Name = grouped ? 'h4' : 'h3'

  return (
    <Section id="menu">
      <SectionHeader eyebrow={t('blocks.menu.eyebrow')} title={title} aside={note} />
      <div className="space-y-12">
        {groups.map((group) => (
          <div key={group.key}>
            {grouped && <h3 className="mb-4 text-label uppercase text-muted">{group.category ?? t('blocks.menu.other')}</h3>}
            <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
              {group.items.map((item) => (
                <li key={item.id} className="flex items-start gap-4 border-b border-line py-5">
                  {item.imageUrl && isMenuImageUrl(item.imageUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resizedImage(item.imageUrl, 480)}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      width={96}
                      height={96}
                      className="aspect-square w-20 shrink-0 rounded-box bg-fg/[0.06] object-cover sm:w-24"
                    />
                  )}
                  <div className="min-w-0 flex-1 break-words">
                    <Name className="text-body font-medium text-fg">{item.name}</Name>
                    {item.description && <p className="mt-1 text-small text-muted">{item.description}</p>}
                  </div>
                  <p className="shrink-0 text-right text-body font-semibold tabular-nums text-fg">
                    {item.price > 0 ? formatVnd(item.price, locale) : t('units.free')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}
