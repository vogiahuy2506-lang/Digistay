import { Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { PublicBlock, PublicService } from '../PropertySite'
import { EmptyState } from './EmptyState'

interface Props {
  block: PublicBlock
  services: PublicService[]
}

export function ServicesBlock({ block, services }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? 'Dịch vụ tiện ích'

  if (services.length === 0) {
    return (
      <section id="services" className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-center mb-4"
            style={{ fontFamily: 'var(--brand-font-heading)' }}
          >
            {title}
          </h2>
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="Danh sách dịch vụ đang được cập nhật"
            description="Các dịch vụ kèm theo sẽ sớm được bổ sung."
          />
        </div>
      </section>
    )
  }

  return (
    <section id="services" className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-4"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Các dịch vụ kèm theo giúp kỳ nghỉ của bạn trọn vẹn hơn
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="p-5 rounded-xl border border-gray-200 hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
              {service.description && (
                <p className="text-sm text-gray-600 mb-3">{service.description}</p>
              )}
              <p
                className="font-bold"
                style={{ color: 'var(--brand-primary)' }}
              >
                {formatCurrency(service.price)}
                <span className="text-xs text-gray-500 font-normal ml-1">
                  {priceTypeLabel(service.priceType, service.perPerson)}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function priceTypeLabel(type: string, perPerson: boolean): string {
  const base =
    type === 'PER_NIGHT'
      ? '/đêm'
      : type === 'PER_PERSON'
        ? '/người'
        : ''
  return perPerson ? `${base} /người` : base
}
