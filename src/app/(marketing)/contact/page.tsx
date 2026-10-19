'use client'

import * as React from 'react'
import { GlassCard, GradientButton, GlassInput } from '@/components/marketing/GradientBackground'

const contactMethods = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Email',
    value: 'support@digistay.vn',
    link: 'mailto:support@digistay.vn',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    title: 'Điện Thoại',
    value: '1900 1234',
    link: 'tel:19001234',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Địa Chỉ',
    value: 'Tầng 15, Tòa nhà ABC Tower, Quận 1, TP.HCM',
    link: null,
  },
]

const teamMembers = [
  {
    name: 'Nguyễn Văn Minh',
    role: 'CEO & Founder',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    linkedin: '#',
  },
  {
    name: 'Trần Thị Lan',
    role: 'Head of Product',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    linkedin: '#',
  },
  {
    name: 'Lê Hoàng Nam',
    role: 'Head of Engineering',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    linkedin: '#',
  },
]

export default function ContactPage() {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
    interest: 'general',
  })
  const [submitted, setSubmitted] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setLoading(false)
    setSubmitted(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24 relative">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
            Liên Hệ
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Chúng Tôi Sẵn Sàng
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Hỗ Trợ Bạn
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Có câu hỏi về sản phẩm, cần tư vấn giải pháp, hay muốn hợp tác? 
            Hãy liên hệ với đội ngũ của chúng tôi.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="pb-16 md:pb-24 relative">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {contactMethods.map((method) => (
              <GlassCard key={method.title} className="p-6 text-center group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 flex items-center justify-center text-orange-400 mx-auto mb-4 group-hover:scale-110 transition-transform">
                  {method.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{method.title}</h3>
                {method.link ? (
                  <a 
                    href={method.link}
                    className="text-white/60 hover:text-orange-400 transition-colors"
                  >
                    {method.value}
                  </a>
                ) : (
                  <p className="text-white/60">{method.value}</p>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="pb-20 md:pb-32 relative">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Form */}
            <div className="lg:col-span-3">
              <GlassCard className="p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Gửi Tin Nhắn</h2>
                
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Cảm Ơn!</h3>
                    <p className="text-white/60 mb-6">
                      Chúng tôi đã nhận được tin nhắn của bạn và sẽ phản hồi trong vòng 24 giờ.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="text-orange-400 hover:text-orange-300 font-medium"
                    >
                      Gửi tin nhắn khác
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-white/80 text-sm font-medium mb-2">
                          Họ và tên <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
                          placeholder="Nguyễn Văn A"
                        />
                      </div>
                      <div>
                        <label className="block text-white/80 text-sm font-medium mb-2">
                          Email <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
                          placeholder="email@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-white/80 text-sm font-medium mb-2">
                          Số điện thoại
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
                          placeholder="0901 234 567"
                        />
                      </div>
                      <div>
                        <label className="block text-white/80 text-sm font-medium mb-2">
                          Công ty/Khách sạn
                        </label>
                        <input
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
                          placeholder="Tên công ty của bạn"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-white/80 text-sm font-medium mb-2">
                        Bạn quan tâm đến
                      </label>
                      <select
                        name="interest"
                        value={formData.interest}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all appearance-none cursor-pointer"
                      >
                        <option value="general" className="bg-slate-900">Tư vấn chung</option>
                        <option value="pricing" className="bg-slate-900">Tư vấn bảng giá</option>
                        <option value="demo" className="bg-slate-900">Xem demo trực tiếp</option>
                        <option value="partnership" className="bg-slate-900">Hợp tác kinh doanh</option>
                        <option value="technical" className="bg-slate-900">Hỗ trợ kỹ thuật</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-white/80 text-sm font-medium mb-2">
                        Nội dung <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={5}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all resize-none"
                        placeholder="Mô tả chi tiết vấn đề hoặc câu hỏi của bạn..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          Gửi Tin Nhắn
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </GlassCard>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              {/* Team */}
              <GlassCard className="p-8">
                <h3 className="text-xl font-bold text-white mb-6">Đội Ngũ Lãnh Đạo</h3>
                <div className="space-y-6">
                  {teamMembers.map((member) => (
                    <div key={member.name} className="flex items-center gap-4">
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">{member.name}</p>
                        <p className="text-white/50 text-sm">{member.role}</p>
                      </div>
                      <a
                        href={member.linkedin}
                        className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-blue-400 hover:bg-white/10 transition-all"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Response Time */}
              <GlassCard className="p-8">
                <h3 className="text-xl font-bold text-white mb-4">Thời Gian Phản Hồi</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Email</span>
                    <span className="text-white font-medium">Trong 24 giờ</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Điện thoại</span>
                    <span className="text-white font-medium">Trong giờ hành chính</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Live Chat</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Online ngay
                    </span>
                  </div>
                </div>
              </GlassCard>

              {/* Social */}
              <GlassCard className="p-8">
                <h3 className="text-xl font-bold text-white mb-4">Kết Nối Với Chúng Tôi</h3>
                <div className="flex gap-3">
                  {[
                    { name: 'Facebook', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
                    { name: 'YouTube', icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
                    { name: 'LinkedIn', icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
                  ].map((social) => (
                    <a
                      key={social.name}
                      href="#"
                      className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d={social.icon} />
                      </svg>
                    </a>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* Map placeholder */}
      <section className="pb-20 md:pb-32 relative">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <GlassCard className="overflow-hidden">
            <div className="aspect-[21/9] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative">
              <img
                src="https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1200&h=500&fit=crop"
                alt="Office Location"
                className="w-full h-full object-cover opacity-40"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Văn Phòng DigiStay</h3>
                  <p className="text-white/60">Tầng 15, Tòa nhà ABC Tower, Quận 1, TP.HCM</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </>
  )
}
