import type { PublicBlock, PublicProperty } from '../PropertySite'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

export function AboutBlock({ block, property }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? 'Về chúng tôi'
  const description = cfg.description ?? property.description

  if (!description) return null

  return (
    <section id="about" className="py-16 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-6"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>
        <p className="text-lg text-gray-700 leading-relaxed text-center whitespace-pre-line">
          {description}
        </p>
      </div>
    </section>
  )
}
