'use client'

import * as React from 'react'
import { GlassCard, GradientButton } from '@/components/marketing/GradientBackground'

const plans = [
  {
    name: 'Starter',
    description: 'Dành cho khách sạn nhỏ mới bắt đầu',
    price: '990.000',
    period: 'tháng',
    highlight: false,
    features: [
      '1 khách sạn',
      '10 phòng',
      'Website cơ bản',
      'Quản lý đặt phòng',
      'Thanh toán VietQR',
      'Hỗ trợ qua chat',
    ],
    limitations: [
      'Không có app di động',
      'Không có email marketing',
      'Không có API access',
    ],
  },
  {
    name: 'Growth',
    description: 'Phù hợp cho khách sạn đang phát triển',
    price: '1.990.000',
    period: 'tháng',
    highlight: true,
    popular: true,
    features: [
      '3 khách sạn',
      '30 phòng',
      'Website nâng cao',
      'Quản lý đặt phòng',
      'Thanh toán đa kênh',
      'App di động',
      'Email marketing',
      'Hỗ trợ ưu tiên',
    ],
    limitations: [],
  },
  {
    name: 'Business',
    description: 'Giải pháp toàn diện cho chuỗi khách sạn',
    price: '4.990.000',
    period: 'tháng',
    highlight: false,
    features: [
      '10 khách sạn',
      '100 phòng',
      'Website cao cấp',
      'Quản lý đặt phòng',
      'Thanh toán đa kênh',
      'App di động',
      'Email & SMS marketing',
      'API access',
      'White-label',
      'Hỗ trợ 24/7',
      'Dedicated account manager',
    ],
    limitations: [],
  },
]

const addOns = [
  {
    name: 'Extra Property',
    description: 'Thêm 1 khách sạn',
    price: '500.000đ/tháng',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    name: 'Extra Rooms',
    description: 'Thêm 10 phòng',
    price: '200.000đ/tháng',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'SMS Marketing',
    description: '1000 SMS/tháng',
    price: '300.000đ/tháng',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    name: 'API Access',
    description: 'Truy cập API đầy đủ',
    price: '500.000đ/tháng',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
]

const faqs = [
  {
    question: 'Tôi có thể hủy gói dịch vụ bất cứ lúc nào không?',
    answer: 'Có, bạn có thể hủy gói dịch vụ bất cứ lúc nào mà không mất phí. Dịch vụ sẽ tiếp tục hoạt động đến cuối kỳ thanh toán đã đóng tiền.',
  },
  {
    question: 'Tôi có cần thuê developer để sử dụng DigiStay không?',
    answer: 'Không, DigiStay được thiết kế để bạn có thể tự quản lý mà không cần kiến thức kỹ thuật. Giao diện kéo-thả trực quan giúp bạn tạo website và quản lý dễ dàng.',
  },
  {
    question: 'Thanh toán như thế nào?',
    answer: 'Chúng tôi chấp nhận thanh toán qua chuyển khoản ngân hàng, VietQR, hoặc thẻ tín dụng/ghi nợ quốc tế (Visa, Mastercard).',
  },
  {
    question: 'Có dùng thử miễn phí không?',
    answer: 'Có, tất cả các gói đều có dùng thử miễn phí 14 ngày. Bạn có thể trải nghiệm đầy đủ tính năng trước khi quyết định đăng ký.',
  },
  {
    question: 'Dữ liệu của tôi có an toàn không?',
    answer: 'Chúng tôi sử dụng mã hóa AES-256, backup hàng ngày, và tuân thủ các tiêu chuẩn bảo mật quốc tế. Dữ liệu của bạn được lưu trữ tại các datacenter ở Singapore.',
  },
]

export default function PricingPage() {
  const [annual, setAnnual] = React.useState(true)
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24 relative">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
            Bảng Giá
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Chọn Gói Phù Hợp
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Với Ngân Sách Của Bạn
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
            Giá cả minh bạch, không phí ẩn. Bắt đầu với dùng thử miễn phí 14 ngày.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1.5 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <button
              onClick={() => setAnnual(false)}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                !annual 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Hàng tháng
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                annual 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Hàng năm
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                -20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 md:pb-32 relative">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((plan) => (
              <GlassCard
                key={plan.name}
                className={`relative p-8 ${
                  plan.highlight ? 'ring-2 ring-orange-500/50' : ''
                }`}
                variant={plan.highlight ? 'highlight' : 'default'}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold shadow-lg">
                      Phổ Biến Nhất
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-white/60 text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl md:text-5xl font-bold text-white">
                      {annual ? plan.price.replace('.000', '.000') : parseInt(plan.price).toLocaleString()}
                    </span>
                    <span className="text-white/60">đ/{plan.period}</span>
                  </div>
                  {annual && (
                    <p className="text-emerald-400 text-sm mt-1">
                      Tiết kiệm {Math.round(parseInt(plan.price) * 0.2 / 1000)}00.000đ/năm
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-white/80">
                      <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                  {plan.limitations?.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-3 text-white/40">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {limitation}
                    </li>
                  ))}
                </ul>

                <GradientButton 
                  href="/register" 
                  variant={plan.highlight ? 'primary' : 'outline'} 
                  className="w-full"
                >
                  Bắt Đầu Dùng Thử
                </GradientButton>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="pb-20 md:pb-32 relative">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Tiện Ích Bổ Sung
            </h2>
            <p className="text-white/60">
              Mở rộng tính năng theo nhu cầu của bạn
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {addOns.map((addon) => (
              <GlassCard key={addon.name} className="p-6">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 mb-4">
                  {addon.icon}
                </div>
                <h4 className="text-lg font-bold text-white mb-1">{addon.name}</h4>
                <p className="text-white/60 text-sm mb-3">{addon.description}</p>
                <p className="text-orange-400 font-bold">{addon.price}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-20 md:pb-32 relative">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Câu Hỏi Thường Gặp
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <GlassCard key={index} className="overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-lg font-medium text-white pr-4">{faq.question}</span>
                  <svg 
                    className={`w-5 h-5 text-white/60 shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6 text-white/60">
                    {faq.answer}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 md:pb-32 relative">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <GlassCard className="p-12 md:p-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Cần Tư Vấn Thêm?
            </h2>
            <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
              Đội ngũ của chúng tôi sẵn sàng hỗ trợ bạn chọn gói phù hợp nhất
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <GradientButton href="/contact" size="lg">
                Liên Hệ Tư Vấn
              </GradientButton>
              <GradientButton href="/register" variant="outline" size="lg">
                Dùng Thử Miễn Phí
              </GradientButton>
            </div>
          </GlassCard>
        </div>
      </section>
    </>
  )
}
