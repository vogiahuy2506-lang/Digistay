import type { PublicBlock } from '../PropertySite'
import { Eyebrow, Section, SectionTitle, cfgText } from '../site-ui'

interface Props {
  block: PublicBlock
}

/**
 * Restaurant menu block. The schema does not model dishes yet, so this says
 * so and points to the contact section. When a RestaurantMenu model exists,
 * render its items here.
 */
export function RestaurantMenuBlock({ block }: Props) {
  const cfg = block.config || {}
  const title = cfgText(cfg, 'title') ?? 'Thực đơn nhà hàng'

  return (
    <Section id="menu">
      <div className="max-w-2xl">
        <Eyebrow>Nhà hàng</Eyebrow>
        <SectionTitle>{title}</SectionTitle>
        <p className="mt-6 text-body text-muted">Thực đơn đang được cập nhật. Vui lòng liên hệ trực tiếp để đặt bàn.</p>
        {cfgText(cfg, 'contactNote') && <p className="mt-2 text-small text-muted">{cfgText(cfg, 'contactNote')}</p>}
      </div>
    </Section>
  )
}
