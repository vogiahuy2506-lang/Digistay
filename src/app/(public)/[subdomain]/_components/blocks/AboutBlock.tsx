import type { PublicBlock, PublicProperty } from '../PropertySite'
import { Eyebrow, Section, SectionTitle, cfgText } from '../site-ui'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

export function AboutBlock({ block, property }: Props) {
  const cfg = block.config || {}
  const title = cfgText(cfg, 'aboutTitle', 'title') ?? 'Về chúng tôi'
  const description = cfgText(cfg, 'aboutContent', 'description') ?? property.description

  if (!description) return null

  return (
    <Section id="about">
      <div className="max-w-3xl">
        <Eyebrow>Giới thiệu</Eyebrow>
        <SectionTitle>{title}</SectionTitle>
        <p className="mt-6 text-lead text-muted whitespace-pre-line">{description}</p>
      </div>
    </Section>
  )
}
