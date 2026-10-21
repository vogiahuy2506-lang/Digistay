import type { PublicBlock, PublicProperty } from '../PropertySite'
import { Eyebrow, Section, SectionTitle, cfgText } from '../site-ui'
import { useTranslations } from 'next-intl'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

export function AboutBlock({ block, property }: Props) {
  const t = useTranslations('site.blocks.about')
  const cfg = block.config || {}
  const title = cfgText(cfg, 'aboutTitle', 'title') ?? t('title')
  const description = cfgText(cfg, 'aboutContent', 'description') ?? property.description

  if (!description) return null

  return (
    <Section id="about">
      <div className="max-w-3xl">
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <SectionTitle>{title}</SectionTitle>
        <p className="mt-6 text-lead text-muted whitespace-pre-line">{description}</p>
      </div>
    </Section>
  )
}
