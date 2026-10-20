'use client'

import * as React from 'react'
import Link from 'next/link'
import { MaterialSymbol } from '@/components/ui/material-symbol'

const contactMethods = [
  {
    icon: 'mail',
    title: 'Email',
    value: 'support@digistay.vn',
    link: 'mailto:support@digistay.vn',
  },
  {
    icon: 'phone',
    title: 'Điện Thoại',
    value: '1900 1234',
    link: 'tel:19001234',
  },
  {
    icon: 'location_on',
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
  },
  {
    name: 'Trần Thị Lan',
    role: 'Head of Product',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
  },
  {
    name: 'Lê Hoàng Nam',
    role: 'Head of Engineering',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
  },
]

const socialLinks = [
  { name: 'Facebook', icon: 'share' },
  { name: 'YouTube', icon: 'smart_display' },
  { name: 'LinkedIn', icon: 'link' },
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
      <section className="pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary-fixed/20 text-on-primary-fixed-variant text-sm font-semibold mb-6">
            Liên Hệ
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
            Chúng Tôi Sẵn Sàng
            <br />
            <span className="bg-gradient-to-r from-primary-fixed to-terracotta-300 bg-clip-text text-transparent">
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
      <section className="pb-12 sm:pb-16 lg:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {contactMethods.map((method) => (
              <div key={method.title} className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-center group hover:bg-white/10 transition-all duration-300">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-terracotta-500/20 flex items-center justify-center text-primary-fixed mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <MaterialSymbol name={method.icon} className="text-2xl" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{method.title}</h3>
                {method.link ? (
                  <a 
                    href={method.link}
                    className="text-white/60 hover:text-primary-fixed transition-colors"
                  >
                    {method.value}
                  </a>
                ) : (
                  <p className="text-white/60">{method.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="pb-16 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Form */}
            <div className="lg:col-span-3">
              <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-6">Gửi Tin Nhắn</h2>
                
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                      <MaterialSymbol name="check_circle" className="text-4xl text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Cảm Ơn!</h3>
                    <p className="text-white/60 mb-6">
                      Chúng tôi đã nhận được tin nhắn của bạn và sẽ phản hồi trong vòng 24 giờ.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="text-primary-fixed hover:text-primary-container font-medium transition-colors"
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
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-primary-fixed/50 focus:bg-white/10 transition-all"
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
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-primary-fixed/50 focus:bg-white/10 transition-all"
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
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-primary-fixed/50 focus:bg-white/10 transition-all"
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
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-primary-fixed/50 focus:bg-white/10 transition-all"
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
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary-fixed/50 focus:bg-white/10 transition-all appearance-none cursor-pointer"
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
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-primary-fixed/50 focus:bg-white/10 transition-all resize-none"
                        placeholder="Mô tả chi tiết vấn đề hoặc câu hỏi của bạn..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full px-6 py-4 rounded-xl bg-primary-fixed text-on-primary-fixed-variant font-semibold shadow-lg hover:bg-primary-container hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          Gửi Tin Nhắn
                          <MaterialSymbol name="send" className="text-xl" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              {/* Team */}
              <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
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
                    </div>
                  ))}
                </div>
              </div>

              {/* Response Time */}
              <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                <h3 className="text-xl font-bold text-white mb-4">Thời Gian Phản Hồi</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 flex items-center gap-2">
                      <MaterialSymbol name="mail" className="text-lg" />
                      Email
                    </span>
                    <span className="text-white font-medium">Trong 24 giờ</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 flex items-center gap-2">
                      <MaterialSymbol name="phone" className="text-lg" />
                      Điện thoại
                    </span>
                    <span className="text-white font-medium">Trong giờ hành chính</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 flex items-center gap-2">
                      <MaterialSymbol name="chat" className="text-lg" />
                      Live Chat
                    </span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Online ngay
                    </span>
                  </div>
                </div>
              </div>

              {/* Social */}
              <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                <h3 className="text-xl font-bold text-white mb-4">Kết Nối Với Chúng Tôi</h3>
                <div className="flex gap-3">
                  {socialLinks.map((social) => (
                    <a
                      key={social.name}
                      href="#"
                      className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                    >
                      <MaterialSymbol name={social.icon} className="text-xl" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="pb-16 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10">
            <div className="aspect-[21/9] relative">
              <img
                src="https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1200&h=500&fit=crop"
                alt="Office Location"
                className="w-full h-full object-cover opacity-40"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-terracotta-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <MaterialSymbol name="location_on" className="text-3xl text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Văn Phòng DigiStay</h3>
                  <p className="text-white/60">Tầng 15, Tòa nhà ABC Tower, Quận 1, TP.HCM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
