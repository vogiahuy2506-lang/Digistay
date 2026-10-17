import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react'
import type { PublicBlock, PublicProperty } from '../PropertySite'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

export function ContactBlock({ block, property }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? 'Liên hệ đặt phòng'

  // Vietnamese phone numbers → zalo.me/<phone>
  const zaloLink = property.phone
    ? `https://zalo.me/${property.phone.replace(/[^0-9]/g, '')}`
    : null

  return (
    <section id="contact" className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-4"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Liên hệ với chúng tôi qua bất kỳ kênh nào dưới đây
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {property.phone && (
            <a
              href={`tel:${property.phone}`}
              className="flex items-center gap-4 p-5 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition"
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Điện thoại</p>
                <p className="font-semibold text-gray-900">{property.phone}</p>
              </div>
            </a>
          )}

          {property.email && (
            <a
              href={`mailto:${property.email}`}
              className="flex items-center gap-4 p-5 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition"
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-semibold text-gray-900">{property.email}</p>
              </div>
            </a>
          )}

          <div className="flex items-center gap-4 p-5 rounded-xl border border-gray-200">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Địa chỉ</p>
              <p className="font-semibold text-gray-900">
                {property.address}, {property.city}
              </p>
            </div>
          </div>

          {zaloLink && (
            <a
              href={zaloLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-5 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0 bg-[#0068FF]">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Zalo</p>
                <p className="font-semibold text-gray-900">Nhắn tin Zalo</p>
              </div>
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
