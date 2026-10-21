import type { PublicBlock } from '../PropertySite'
import { Eyebrow, Section, SectionTitle, cfgText } from '../site-ui'
import { useTranslations } from 'next-intl'

interface Props {
  block: PublicBlock
}

/**
 * Restaurant menu block. The schema does not model dishes yet, so this says
 * so and points to the contact section. When a RestaurantMenu model exists,
 * render its items here.
 */
export function RestaurantMenuBlock({ block }: Props) {
  const t = useTranslations('site.blocks.menu')
  const cfg = block.config || {}
  const title = cfgText(cfg, 'title') ?? t('title')

  return (
    <Section id="menu">
      <div className="max-w-2xl">
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <SectionTitle>{title}</SectionTitle>
        <p className="mt-6 text-body text-muted">{t('empty')}</p>
        {cfgText(cfg, 'contactNote') && <p className="mt-2 text-small text-muted">{cfgText(cfg, 'contactNote')}</p>}
      </div>
    </Section>
  )
}
