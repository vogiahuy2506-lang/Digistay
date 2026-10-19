import { Star, Quote } from 'lucide-react'
import type { PublicBlock } from '../PropertySite'

interface Props {
  block: PublicBlock
}

export function ReviewsBlock({ block }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? 'Khách hàng nói gì về chúng tôi'

  return (
    <section id="reviews" className="py-16 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-4"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Tính năng thu thập đánh giá sẽ được tích hợp khi ra mắt phiên bản tiếp theo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
            >
              <Quote
                className="w-8 h-8 mb-3 opacity-30"
                style={{ color: 'var(--brand-primary)' }}
              />
              <p className="text-gray-700 mb-4 italic">
                &quot;Dịch vụ tuyệt vời, phòng sạch đẹp, nhân viên nhiệt tình. Sẽ quay lại!&quot;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  K
                </div>
                <div>
                  <p className="font-medium text-gray-900">Khách hàng {i}</p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-3 h-3 text-yellow-400 fill-yellow-400"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
