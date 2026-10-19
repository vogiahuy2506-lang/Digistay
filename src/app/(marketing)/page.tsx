'use client'

import * as React from 'react'
import Link from 'next/link'
import { MaterialSymbol } from '@/components/ui/material-symbol'

const stats = [
  { value: '10K+', label: 'Khách sạn tin dùng', icon: 'hotel' },
  { value: '0%', label: 'Phí hoa hồng', icon: 'percent' },
  { value: '50+', label: 'Quốc gia', icon: 'public' },
  { value: '99.9%', label: 'Uptime', icon: 'verified' },
]

const features = [
  {
    icon: 'desktop_windows',
    title: 'Website Builder',
    description: 'Tạo website đẹp không cần code với 20+ mẫu được thiết kế sẵn cho khách sạn boutique',
  },
  {
    icon: 'event_available',
    title: 'Quản Lý Đặt Phòng',
    description: 'Quản lý booking, phòng trống, và lịch đặt phòng thông minh theo thời gian thực',
  },
  {
    icon: 'payments',
    title: 'Thanh Toán Tự Động',
    description: 'Tích hợp VietQR, Stripe, PayOS. Thanh toán tự động, hoàn tiền dễ dàng',
  },
  {
    icon: 'receipt_long',
    title: 'Hóa Đơn & Báo Cáo',
    description: 'Xuất hóa đơn điện tử, báo cáo doanh thu chi tiết theo ngày, tháng, năm',
  },
  {
    icon: 'star',
    title: 'Đánh Giá Khách Hàng',
    description: 'Thu thập và quản lý đánh giá từ khách hàng, nâng cao uy tín trực tuyến',
  },
  {
    icon: 'smartphone',
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
  { feature: 'Đặt phòng trực tiếp', digistay: true, booking: false, agoda: false },
  { feature: 'Kiểm soát thương hiệu', digistay: true, booking: false, agoda: false },
  { feature: 'Dữ liệu khách hàng', digistay: '100%', booking: '0%', agoda: '0%' },
  { feature: 'Chương trình khách hàng thân thiết', digistay: true, booking: false, agoda: false },
]

const savingsData = [
  { months: '12', savings: '36M', traditional: '54M' },
  { months: '24', savings: '72M', traditional: '108M' },
  { months: '36', savings: '108M', traditional: '162M' },
]

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section id="hero" className="min-h-[90vh] flex items-center justify-center relative px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-xl mb-8 animate-fade-in-up shadow-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/90 text-sm font-medium">
              Nền tảng No-Code Xây Dựng Kênh Bán Phòng Độc Quyền
            </span>
            <span className="text-primary-fixed font-bold">• 0% Phí Sàn</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-8 animate-fade-in-up animation-delay-200">
            Biến Khách Sạn Của Bạn
            <br />
            <span className="bg-gradient-to-r from-primary-fixed via-terracotta-300 to-primary-fixed bg-clip-text text-transparent">
              Thành Thương Hiệu
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-white/60 max-w-3xl mx-auto mb-12 animate-fade-in-up animation-delay-400 leading-relaxed">
            DigiStay giúp bạn xây dựng website bán phòng chuyên nghiệp, 
            quản lý booking thông minh, và tăng doanh thu từ kênh độc quyền 
            thay vì phụ thuộc vào các sàn OTA.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 animate-fade-in-up animation-delay-600">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary-fixed text-on-primary-fixed-variant font-bold text-lg shadow-2xl shadow-primary/40 hover:bg-primary-container hover:scale-105 transition-all duration-300"
            >
              <span>Dùng Thử Miễn Phí 14 Ngày</span>
              <MaterialSymbol name="arrow_forward" className="text-xl" />
            </Link>
            <Link
              href="/#features"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/10 text-white font-semibold text-lg border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all duration-300"
            >
              <MaterialSymbol name="explore" className="text-xl" />
              <span>Khám Phá Tính Năng</span>
            </Link>
          </div>

          {/* Hero Image */}
          <div className="relative max-w-5xl mx-auto animate-fade-in-up animation-delay-800">
            <div className="rounded-3xl overflow-hidden shadow-2xl shadow-black/30 border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&h=675&fit=crop"
                alt="DigiStay Dashboard Preview"
                className="w-full"
              />
            </div>
            
            {/* Floating Stats Card */}
            <div className="absolute -right-4 sm:right-8 top-1/4 p-5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl animate-float">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                  <MaterialSymbol name="trending_up" className="text-2xl text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-2xl">+127%</p>
                  <p className="text-white/60 text-sm">Booking trực tiếp</p>
                </div>
              </div>
            </div>

            {/* Floating Booking Card */}
            <div className="absolute -left-4 sm:left-8 bottom-1/4 p-5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl animate-float-delay-1">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-terracotta-600 flex items-center justify-center shadow-lg">
                  <MaterialSymbol name="check_circle" className="text-2xl text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-xl">Đơn mới</p>
                  <p className="text-white/60 text-sm">2 phút trước</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
          <MaterialSymbol name="keyboard_arrow_down" className="text-3xl text-white/40" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 sm:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-center">
                <MaterialSymbol name={stat.icon} className="text-3xl text-primary-fixed mx-auto mb-3" />
                <p className="text-3xl sm:text-4xl font-bold text-white mb-1">
                  {stat.value}
                </p>
                <p className="text-white/60 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 lg:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary-fixed/20 text-on-primary-fixed-variant text-sm font-semibold mb-4">
              Tính Năng
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
              Mọi Thứ Bạn Cần Để
              <span className="bg-gradient-to-r from-primary-fixed to-terracotta-300 bg-clip-text text-transparent"> Quản Lý Khách Sạn</span>
            </h2>
            <p className="text-lg text-white/60">
              DigiStay cung cấp giải pháp toàn diện cho việc quản lý khách sạn boutique, 
              từ website đến thanh toán, tất cả trong một nền tảng.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 hover:border-primary-fixed/30 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-terracotta-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <MaterialSymbol name={feature.icon} className="text-2xl text-primary-fixed" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-white/60 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section id="templates" className="py-16 sm:py-24 lg:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary-fixed/20 text-on-primary-fixed-variant text-sm font-semibold mb-4">
              Mẫu Giao Diện
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
              Website Đẹp,
              <span className="bg-gradient-to-r from-primary-fixed to-terracotta-300 bg-clip-text text-transparent"> Không Cần Code</span>
            </h2>
            <p className="text-lg text-white/60">
              Chọn từ hàng chục mẫu được thiết kế chuyên nghiệp cho mọi loại hình khách sạn boutique
            </p>
          </div>

          {/* Templates Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div key={template.name} className="rounded-2xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 group cursor-pointer hover:scale-[1.02] transition-all duration-300">
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
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 text-primary-fixed hover:text-primary-container font-semibold transition-colors"
            >
              Xem tất cả mẫu giao diện
              <MaterialSymbol name="arrow_forward" className="text-xl" />
            </Link>
          </div>
        </div>
      </section>

      {/* OTA Comparison Section */}
      <section id="compare" className="py-16 sm:py-24 lg:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div>
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-fixed/20 text-on-primary-fixed-variant text-sm font-semibold mb-4">
                So Sánh OTA
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
                Tại Sao Nên
                <span className="bg-gradient-to-r from-primary-fixed to-terracotta-300 bg-clip-text text-transparent"> Bán Trực Tiếp?</span>
              </h2>
              <p className="text-lg text-white/60 mb-8 leading-relaxed">
                Các sàn OTA như Booking.com hay Agoda thu phí hoa hồng 15-20% cho mỗi booking. 
                Với DigiStay, bạn giữ 100% doanh thu từ kênh bán phòng độc quyền.
              </p>
              
              {/* Comparison Table */}
              <div className="rounded-2xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="text-left p-4 text-white/60 font-medium">Tính năng</th>
                      <th className="text-center p-4 text-primary-fixed font-bold">DigiStay</th>
                      <th className="text-center p-4 text-white/40 font-medium">Booking</th>
                      <th className="text-center p-4 text-white/40 font-medium">Agoda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otaComparison.map((row) => (
                      <tr key={row.feature} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 text-white/80">{row.feature}</td>
                        <td className="p-4 text-center">
                          {typeof row.digistay === 'boolean' ? (
                            row.digistay ? (
                              <MaterialSymbol name="check" className="text-emerald-400 text-xl mx-auto" />
                            ) : (
                              <MaterialSymbol name="close" className="text-red-400 text-xl mx-auto" />
                            )
                          ) : (
                            <span className="text-emerald-400 font-bold">{row.digistay}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof row.booking === 'boolean' ? (
                            row.booking ? (
                              <MaterialSymbol name="check" className="text-red-400 text-xl mx-auto" />
                            ) : (
                              <MaterialSymbol name="close" className="text-red-400 text-xl mx-auto" />
                            )
                          ) : (
                            <span className="text-red-400">{row.booking}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof row.agoda === 'boolean' ? (
                            row.agoda ? (
                              <MaterialSymbol name="check" className="text-red-400 text-xl mx-auto" />
                            ) : (
                              <MaterialSymbol name="close" className="text-red-400 text-xl mx-auto" />
                            )
                          ) : (
                            <span className="text-red-400">{row.agoda}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Savings Calculator */}
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <MaterialSymbol name="savings" className="text-primary-fixed text-3xl" />
                Tiết Kiệm Của Bạn
              </h3>
              
              <div className="space-y-4 mb-8">
                {savingsData.map((item) => (
                  <div key={item.months} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div>
                      <p className="text-white font-bold text-lg">{item.months} tháng</p>
                      <p className="text-white/40 text-sm">với 10 phòng</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold text-xl">{item.savings}đ</p>
                      <p className="text-white/40 text-sm line-through">{item.traditional}đ</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/pricing"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                Xem Bảng Giá Chi Tiết
                <MaterialSymbol name="arrow_forward" className="text-xl" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 lg:py-32 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-12 sm:p-16 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-primary-fixed/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-terracotta-400/20 to-transparent rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
                Sẵn Sàng Biến Ý Tưởng
                <br />
                <span className="bg-gradient-to-r from-primary-fixed to-terracotta-300 bg-clip-text text-transparent">Thành Hiện Thực?</span>
              </h2>
              <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto">
                Bắt đầu dùng thử miễn phí 14 ngày. Không cần thẻ tín dụng, không cam kết.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary-fixed text-on-primary-fixed-variant font-bold text-lg shadow-xl hover:bg-primary-container hover:scale-105 transition-all duration-300"
                >
                  Bắt Đầu Miễn Phí
                  <MaterialSymbol name="arrow_forward" className="text-xl" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-all duration-300"
                >
                  Liên Hệ Tư Vấn
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
