'use client'

import * as React from 'react'
import Link from 'next/link'
import { GradientBackground, GlassCard, GradientButton } from '@/components/marketing/GradientBackground'

const stats = [
  { value: '10K+', label: 'Khách sạn tin dùng' },
  { value: '0%', label: 'Phí hoa hồng' },
  { value: '50+', label: 'Quốc gia' },
  { value: '99.9%', label: 'Uptime' },
]

const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Website Builder',
    description: 'Tạo website đẹp không cần code với 20+ mẫu được thiết kế sẵn cho khách sạn boutique',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Quản Lý Đặt Phòng',
    description: 'Quản lý booking, phòng trống, và lịch đặt phòng thông minh theo thời gian thực',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: 'Thanh Toán Tự Động',
    description: 'Tích hợp VietQR, Stripe, PayOS. Thanh toán tự động, hoàn tiền dễ dàng',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Hóa Đơn & Báo Cáo',
    description: 'Xuất hóa đơn điện tử, báo cáo doanh thu chi tiết theo ngày, tháng, năm',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    title: 'Đánh Giá Khách Hàng',
    description: 'Thu thập và quản lý đánh giá từ khách hàng, nâng cao uy tín trực tuyến',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Ứng Dụng Di Động',
    description: 'Quản lý mọi lúc mọi nơi với ứng dụng trên iOS và Android',
  },
]

const templates = [
  {
    name: 'Mountain Lodge',
    description: 'Thiết kế ấm cúng cho homestay, cabin',
    image: 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=600&h=400&fit=crop',
  },
  {
    name: 'Beach Resort',
    description: 'Phong cách biển xanh, thư giãn',
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&h=400&fit=crop',
  },
  {
    name: 'City Boutique',
    description: 'Hiện đại, sang trọng cho khách sạn thành phố',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop',
  },
]

const otaComparison = [
  { feature: 'Phí hoa hồng', digistay: '0%', booking: '15-20%', agoda: '15-18%' },
  { feature: 'Đặt phòng trực tiếp', digistay: '✓', booking: '✗', agoda: '✗' },
  { feature: 'Kiểm soát thương hiệu', digistay: '✓', booking: '✗', agoda: '✗' },
  { feature: 'Dữ liệu khách hàng', digistay: '100%', booking: '0%', agoda: '0%' },
  { feature: 'Chương trình khách hàng thân thiết', digistay: '✓', booking: '✗', agoda: '✗' },
]

const savingsData = [
  { months: '12', savings: '36M', traditional: '54M', digistay: '18M' },
  { months: '24', savings: '72M', traditional: '108M', digistay: '36M' },
  { months: '36', savings: '108M', traditional: '162M', digistay: '54M' },
]

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section id="hero" className="min-h-screen flex items-center justify-center relative pt-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/80 text-sm font-medium">
              Nền tảng No-Code Xây Dựng Kênh Bán Phòng Độc Quyền
            </span>
            <span className="text-orange-400 font-bold">0% Phí Sàn</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6 animate-fade-in-up animation-delay-200">
            Biến Khách Sạn Của Bạn
            <br />
            <span className="bg-gradient-to-r from-orange-400 via-red-400 to-amber-400 bg-clip-text text-transparent">
              Thành Thương Hiệu
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto mb-10 animate-fade-in-up animation-delay-400">
            DigiStay giúp bạn xây dựng website bán phòng chuyên nghiệp, 
            quản lý booking thông minh, và tăng doanh thu từ kênh độc quyền 
            thay vì phụ thuộc vào các sàn OTA.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up animation-delay-600">
            <GradientButton href="/register" size="lg" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            }>
              Dùng Thử Miễn Phí 14 Ngày
            </GradientButton>
            <GradientButton href="/#features" variant="outline" size="lg">
              Khám Phá Tính Năng
            </GradientButton>
          </div>

          {/* Hero Image / Dashboard Preview */}
          <div className="relative max-w-5xl mx-auto animate-fade-in-up animation-delay-800">
            <GlassCard className="p-2">
              <div className="aspect-video rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&h=675&fit=crop"
                  alt="DigiStay Dashboard Preview"
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
              </div>
            </GlassCard>
            
            {/* Floating Stats Card */}
            <GlassCard className="absolute -right-4 md:right-8 top-1/4 p-4 animate-float">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-bold text-lg">+127%</p>
                  <p className="text-white/60 text-sm">Booking trực tiếp</p>
                </div>
              </div>
            </GlassCard>

            {/* Floating Booking Card */}
            <GlassCard className="absolute -left-4 md:left-8 bottom-1/4 p-4 animate-float-delay-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Đơn mới</p>
                  <p className="text-white/60 text-sm">2 phút trước</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
          <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {stats.map((stat, index) => (
              <GlassCard key={stat.label} className="p-6 text-center" variant="dark">
                <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </p>
                <p className="text-white/60 text-sm">{stat.label}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-4">
              Tính Năng
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Mọi Thứ Bạn Cần Để
              <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent"> Quản Lý Khách Sạn</span>
            </h2>
            <p className="text-lg text-white/60">
              DigiStay cung cấp giải pháp toàn diện cho việc quản lý khách sạn boutique, 
              từ website đến thanh toán, tất cả trong một nền tảng.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <GlassCard key={feature.title} className="p-6 group hover:bg-white/10 transition-all duration-300">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 flex items-center justify-center text-orange-400 mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-white/60">{feature.description}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section id="templates" className="py-20 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-4">
              Mẫu Giao Diện
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Website Đẹp,
              <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent"> Không Cần Code</span>
            </h2>
            <p className="text-lg text-white/60">
              Chọn từ hàng chục mẫu được thiết kế chuyên nghiệp cho mọi loại hình khách sạn boutique
            </p>
          </div>

          {/* Templates Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {templates.map((template) => (
              <GlassCard key={template.name} className="overflow-hidden group cursor-pointer">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={template.image}
                    alt={template.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{template.name}</h3>
                  <p className="text-white/60 text-sm">{template.description}</p>
                </div>
              </GlassCard>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              Xem tất cả mẫu giao diện
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* OTA Comparison Section */}
      <section id="compare" className="py-20 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div>
              <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-4">
                So Sánh OTA
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Tại Sao Nên
                <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent"> Bán Trực Tiếp?</span>
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Các sàn OTA như Booking.com hay Agoda thu phí hoa hồng 15-20% cho mỗi booking. 
                Với DigiStay, bạn giữ 100% doanh thu từ kênh bán phòng độc quyền.
              </p>
              
              {/* Comparison Table */}
              <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-white/60 font-medium">Tính năng</th>
                        <th className="text-center p-4 text-orange-400 font-bold">DigiStay</th>
                        <th className="text-center p-4 text-white/40 font-medium">Booking</th>
                        <th className="text-center p-4 text-white/40 font-medium">Agoda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otaComparison.map((row) => (
                        <tr key={row.feature} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-white/80">{row.feature}</td>
                          <td className="p-4 text-center text-emerald-400 font-bold">{row.digistay}</td>
                          <td className="p-4 text-center text-red-400">{row.booking}</td>
                          <td className="p-4 text-center text-red-400">{row.agoda}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>

            {/* Savings Calculator */}
            <div>
              <GlassCard className="p-8">
                <h3 className="text-2xl font-bold text-white mb-6">
                  Tiết Kiệm Của Bạn
                </h3>
                
                <div className="space-y-4 mb-8">
                  {savingsData.map((item) => (
                    <div key={item.months} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                      <div>
                        <p className="text-white font-bold">{item.months} tháng</p>
                        <p className="text-white/40 text-sm">với 10 phòng</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold text-xl">{item.savings}đ</p>
                        <p className="text-white/40 text-sm line-through">{item.traditional}đ</p>
                      </div>
                    </div>
                  ))}
                </div>

                <GradientButton href="/pricing" variant="secondary" className="w-full">
                  Xem Bảng Giá Chi Tiết
                </GradientButton>
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 relative">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
          <GlassCard className="p-12 md:p-16 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-orange-500/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-red-500/20 to-transparent rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Sẵn Sàng Biến Ý Tưởng
                <br />
                <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">Thành Hiện Thực?</span>
              </h2>
              <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto">
                Bắt đầu dùng thử miễn phí 14 ngày. Không cần thẻ tín dụng, không cam kết.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <GradientButton href="/register" size="lg" icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                }>
                  Bắt Đầu Miễn Phí
                </GradientButton>
                <GradientButton href="/contact" variant="outline" size="lg">
                  Liên Hệ Tư Vấn
                </GradientButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </>
  )
}
