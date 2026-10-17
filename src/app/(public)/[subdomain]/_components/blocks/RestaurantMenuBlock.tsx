import { Utensils } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { PublicBlock } from '../PropertySite'

interface Props {
  block: PublicBlock
}

/**
 * Restaurant menu block. The schema does not yet model dishes, so this
 * block renders an empty-state inviting the hotel to add menu items via
 * a future /api/... endpoint. When the RestaurantMenu model is added
 * to schema.prisma, replace the empty branch with a real fetch.
 */
export function RestaurantMenuBlock({ block }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? 'Thực đơn nhà hàng'

  return (
    <section id="menu" className="py-16 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-4"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Hương vị ẩm thực đặc sắc
        </p>

        <div className="text-center py-12">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <Utensils className="w-8 h-8" />
          </div>
          <p className="text-gray-600">
            Thực đơn đang được cập nhật. Vui lòng liên hệ trực tiếp để đặt bàn.
          </p>
          {cfg.contactNote && (
            <p className="text-sm text-gray-500 mt-2">{String(cfg.contactNote)}</p>
          )}
        </div>
      </div>
    </section>
  )
}
