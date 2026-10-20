'use client'

import * as React from 'react'
import Link from 'next/link'
import { MaterialSymbol } from '@/components/ui/material-symbol'

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
    icon: 'apartment',
  },
  {
    name: 'Extra Rooms',
    description: 'Thêm 10 phòng',
    price: '200.000đ/tháng',
    icon: 'meeting_room',
  },
  {
    name: 'SMS Marketing',
    description: '1000 SMS/tháng',
    price: '300.000đ/tháng',
    icon: 'chat',
  },
  {
    name: 'API Access',
    description: 'Truy cập API đầy đủ',
    price: '500.000đ/tháng',
    icon: 'code',
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
      <section className="pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary-fixed/20 text-on-primary-fixed-variant text-sm font-semibold mb-6">
            Bảng Giá
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
            Chọn Gói Phù Hợp
            <br />
            <span className="bg-gradient-to-r from-primary-fixed to-terracotta-300 bg-clip-text text-transparent">
              Với Ngân Sách Của Bạn
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
            Giá cả minh bạch, không phí ẩn. Bắt đầu với dùng thử miễn phí 14 ngày.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
            <button
              onClick={() => setAnnual(false)}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                !annual 
                  ? 'bg-primary-fixed text-on-primary-fixed-variant shadow-lg' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Hàng tháng
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                annual 
                  ? 'bg-primary-fixed text-on-primary-fixed-variant shadow-lg' 
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
      <section className="pb-16 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-8 rounded-2xl backdrop-blur-xl border ${
                  plan.highlight 
                    ? 'bg-primary-fixed/10 border-primary-fixed/50 ring-2 ring-primary-fixed/30' 
                    : 'bg-white/5 border-white/10'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-sm font-bold shadow-lg">
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
                      {plan.price}
                    </span>
                    <span className="text-white/60">đ/{plan.period}</span>
                  </div>
                  {annual && (
                    <p className="text-emerald-400 text-sm mt-1">
                      Tiết kiệm {Math.round(parseInt(plan.price.replace(/\./g, '')) * 0.2 / 1000) * 1000}đ/năm
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-white/80">
                      <MaterialSymbol name="check" className="text-emerald-400 text-xl shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                  {plan.limitations?.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-3 text-white/40">
                      <MaterialSymbol name="close" className="text-white/30 text-xl shrink-0 mt-0.5" />
                      {limitation}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold transition-all duration-300 ${
                    plan.highlight
                      ? 'bg-primary-fixed text-on-primary-fixed-variant shadow-lg hover:bg-primary-container hover:scale-[1.02]'
                      : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                  }`}
                >
                  Bắt Đầu Dùng Thử
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="pb-16 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              Tiện Ích Bổ Sung
            </h2>
            <p className="text-white/60">
              Mở rộng tính năng theo nhu cầu của bạn
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {addOns.map((addon) => (
              <div key={addon.name} className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed/10 flex items-center justify-center text-primary-fixed mb-4">
                  <MaterialSymbol name={addon.icon} className="text-2xl" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">{addon.name}</h4>
                <p className="text-white/60 text-sm mb-3">{addon.description}</p>
                <p className="text-primary-fixed font-bold">{addon.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-16 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              Câu Hỏi Thường Gặp
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="rounded-2xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-lg font-medium text-white pr-4">{faq.question}</span>
                  <MaterialSymbol 
                    name={openFaq === index ? 'expand_less' : 'expand_more'} 
                    className="text-white/60 text-2xl shrink-0" 
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6 text-white/60">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="p-12 sm:p-16 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-primary-fixed/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-terracotta-400/20 to-transparent rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
                Cần Tư Vấn Thêm?
              </h2>
              <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
                Đội ngũ của chúng tôi sẵn sàng hỗ trợ bạn chọn gói phù hợp nhất
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary-fixed text-on-primary-fixed-variant font-bold text-lg shadow-xl hover:bg-primary-container hover:scale-105 transition-all duration-300"
                >
                  Liên Hệ Tư Vấn
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-all duration-300"
                >
                  Dùng Thử Miễn Phí
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
