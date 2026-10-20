import { formatVnd } from '@/lib/bookings/display'
import type { PublicBlock, PublicService } from '../PropertySite'
import { Section, SectionHeader, cfgText } from '../site-ui'

interface Props {
  block: PublicBlock
  services: PublicService[]
}

export function ServicesBlock({ block, services }: Props) {
  const cfg = block.config || {}
  const title = cfgText(cfg, 'servicesTitle', 'title') ?? 'Dịch vụ thêm'

  return (
    <Section id="services">
      <SectionHeader eyebrow="Dịch vụ" title={title} aside={services.length > 0 ? 'Chọn thêm khi đặt phòng.' : undefined} />
      {services.length === 0 ? (
        <p className="text-body text-muted">Danh sách dịch vụ đang được cập nhật.</p>
      ) : (
        <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.id} className="flex items-start justify-between gap-4 border-b border-line py-5">
              <div className="min-w-0">
                <h3 className="text-body font-medium text-fg">{service.name}</h3>
                {service.description && <p className="mt-1 text-small text-muted">{service.description}</p>}
              </div>
              <p className="shrink-0 text-right text-body font-semibold tabular-nums text-fg">
                {service.price > 0 ? formatVnd(service.price) : 'Miễn phí'}
                {service.price > 0 && <span className="block text-xs font-normal text-muted">{priceTypeLabel(service.priceType, service.perPerson)}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/** "/đêm", "/người", "/đêm /người"; never "/người /người" as before. */
function priceTypeLabel(type: string, perPerson: boolean): string {
  const unit = type === 'PER_NIGHT' ? '/đêm' : type === 'PER_PERSON' ? '/người' : 'một lần'
  return perPerson && type !== 'PER_PERSON' ? `${unit} /người` : unit
}
