'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

type AuthMode = 'password' | 'otp' | 'passkey'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [authMode, setAuthMode] = React.useState<AuthMode>('password')
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState('')
  
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    otp: '',
    rememberMe: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setStatusMessage('Đang kết nối cơ sở dữ liệu...')

    try {
      if (authMode === 'password') {
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        })

        if (result?.error) {
          setStatusMessage('')
          alert('Email hoặc mật khẩu không chính xác')
          setIsLoading(false)
          return
        }

        setStatusMessage('Xác thực thành công! Đang chuyển hướng...')
        // Wait a bit for session to be established, then redirect
        setTimeout(() => {
          // Preserve URL params for workspace creation
          const hotelName = searchParams.get('hotelName')
          const phone = searchParams.get('phone')
          const scale = searchParams.get('scale')
          const createWorkspace = searchParams.get('createWorkspace')
          
          const params = new URLSearchParams()
          if (hotelName) params.set('hotelName', hotelName)
          if (phone) params.set('phone', phone)
          if (scale) params.set('scale', scale)
          if (createWorkspace) params.set('createWorkspace', createWorkspace)
          
          const redirectUrl = params.toString() 
            ? `/workspaces?${params.toString()}`
            : '/workspaces'
          
          router.push(redirectUrl)
        }, 300)
      } else if (authMode === 'otp') {
        // OTP verification would go here
        setStatusMessage('Đang xác thực OTP...')
        setTimeout(() => {
          alert('Tính năng OTP đang được phát triển')
          setIsLoading(false)
          setStatusMessage('')
        }, 1000)
      } else if (authMode === 'passkey') {
        // Passkey verification would go here
        setStatusMessage('Đang xác thực Passkey...')
        setTimeout(() => {
          alert('Tính năng Passkey đang được phát triển')
          setIsLoading(false)
          setStatusMessage('')
        }, 1000)
      }
    } catch (error) {
      setStatusMessage('')
      alert('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      if (authMode === 'password') {
        setIsLoading(false)
      }
    }
  }

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode)
    setStatusMessage('')
  }

  const getSubmitButtonText = () => {
    if (statusMessage) return statusMessage
    switch (authMode) {
      case 'password': return 'Đăng nhập vào Hệ điều hành'
      case 'otp': return 'Xác thực OTP & Vào hệ thống'
      case 'passkey': return 'Xác thực với FaceID / TouchID'
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-terracotta selection:text-white ambient-mesh" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* TOP BRANDING & LUXURY NAV HEADER */}
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between z-20">
        <a className="flex items-center gap-3.5 group" href="#">
          <div className="w-10 h-10 rounded-xl bg-charcoal flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105">
            <span className="material-symbols-outlined text-[22px] text-terracotta">domain_add</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xl font-extrabold tracking-tight text-charcoal">Digi<span className="text-terracotta">Stay</span></span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-terracotta/10 text-terracotta ml-1 border border-terracotta/20">OS 4.0</span>
            </div>
            <span className="text-[11px] font-medium tracking-wider text-charcoal-muted uppercase mt-0.5">Boutique Hospitality Operating System</span>
          </div>
        </a>
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Live Server Status Indicator */}
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-card/80 border border-stone-200 text-xs text-charcoal-muted shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium">Hệ thống: Bình thường • 99.99% SLA</span>
          </div>
          {/* Language Switcher */}
          <div className="flex items-center bg-stone-200/70 p-1 rounded-xl">
            <button className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-charcoal shadow-sm transition" type="button">VN</button>
            <button className="px-2.5 py-1 rounded-lg text-xs font-medium text-charcoal-muted hover:text-charcoal transition" type="button">EN</button>
          </div>
          {/* Concierge & Hotline Pill */}
          <a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-stone-200/80 text-xs font-semibold text-charcoal shadow-sm hover:border-terracotta/40 hover:text-terracotta transition" href="tel:19008866">
            <span className="material-symbols-outlined text-[16px] text-terracotta">ring_volume</span>
            <span className="hidden sm:inline">Hotline 24/7:</span>
            <span className="text-terracotta font-bold">1900 8866</span>
          </a>
        </div>
      </header>

      {/* MAIN EDITORIAL LOGIN EXPERIENCE */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 rounded-3xl bg-white shadow-luxury border border-stone-200/70 overflow-hidden">
          {/* LEFT COLUMN: ATMOSPHERIC EDITORIAL CANVAS & LIVE PROPERTY SHOWCASE */}
          <div className="lg:col-span-5 relative min-h-[520px] lg:min-h-[720px] p-8 sm:p-10 flex flex-col justify-between overflow-hidden bg-charcoal text-white">
            {/* Visual Backdrop with Rich Atmosphere */}
            <img alt="Luxury Dalat Retreat" className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.82] contrast-[1.05] transition-transform duration-1000 ease-out" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMnqHDn-64hCD0ne5bNBMa1VgOjDMv3nGZrTSKbdZ4oC70MHrC7BTMYiPNuGNQQu15flf0JjLsMigbUkp-W-zmVm50gb1YVhpjE9upcGQ65mFoIbhpvYcyiuuXmUZKfqbBcefWLxfzRwklNkRrOS8E3AMKj-x-dE9IVXMqinIMjfHAXyordAoQvtJaB-lIRyVczP21zFnKiQSbLSnVXzAGlWoFASXYgnJYnzen6KAjaaAdbaCNFTke" />
            {/* Subtle Warm Vignettes & Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/20 to-black/20 pointer-events-none"></div>
            {/* Top Subtle Brand Status Tag */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full custom-glass text-xs font-medium tracking-wide text-white/90">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="">Cloud PMS &amp; Multi-Channel Manager</span>
              </div>
              <span className="text-[11px] font-semibold text-white/80 uppercase tracking-widest">DigiStay Collection</span>
            </div>
            {/* Bottom Minimalist Testimonial & Signature */}
            <div className="relative z-10 space-y-4 pt-10">
              <div className="flex items-center gap-1.5 text-amber-300">
                <span className="material-symbols-outlined text-[18px]">star</span>
                <span className="material-symbols-outlined text-[18px]">star</span>
                <span className="material-symbols-outlined text-[18px]">star</span>
                <span className="material-symbols-outlined text-[18px]">star</span>
                <span className="material-symbols-outlined text-[18px]">star</span>
                <span className="text-xs font-semibold text-white/90 ml-1.5">5.0 Tuyệt đối • An Yên Valley</span>
              </div>
              <p className="text-base text-white/95 font-light leading-relaxed italic max-w-md drop-shadow-sm font-serif">
                "DigiStay giúp chúng tôi tối ưu 40% thời gian lễ tân, tự động hóa thanh toán VietQR và hoàn toàn xóa bỏ rủi ro overbooking trên các kênh quốc tế."
              </p>
              <div className="flex items-center gap-3 pt-1 border-t border-white/10">
                <div className="w-9 h-9 rounded-full border border-amber-300/40 bg-stone-700/80 flex items-center justify-center font-bold text-amber-300 text-xs shadow-sm">
                  MA
                </div>
                <div>
                  <p className="text-xs font-semibold text-white tracking-wide">Hoàng Mai Anh</p>
                  <p className="text-[11px] text-stone-300">Nhà sáng lập &amp; Điều hành — An Yên Valley Eco-Resort</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: THE ULTRA-PREMIUM REFINED LOGIN WORKSPACE */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-14 flex flex-col justify-between bg-white">
            {/* TOP: FORM HEADER & TITLE */}
            <div>
              <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight font-serif mb-2">
                  Chào mừng trở lại <span className="font-sans text-terracotta font-bold">.</span>
                </h1>
                <p className="text-sm text-charcoal-muted">
                  Hệ điều hành quản lý phòng, hóa đơn và trải nghiệm khách lưu trú cao cấp
                </p>
              </div>

              {/* AUTH MODE TABS */}
              <div className="flex items-center justify-between mb-4 pb-1 border-b border-stone-100">
                <div className="flex items-center gap-6">
                  <button 
                    className={`text-xs font-bold pb-2 border-b-2 transition ${authMode === 'password' ? 'text-terracotta border-terracotta' : 'text-charcoal-muted border-transparent hover:text-charcoal'}`}
                    onClick={() => switchAuthMode('password')}
                    type="button"
                  >
                    Mật khẩu quản trị
                  </button>
                  <button 
                    className={`text-xs font-medium pb-2 border-b-2 transition flex items-center gap-1.5 ${authMode === 'otp' ? 'text-terracotta border-terracotta font-bold' : 'text-charcoal-muted border-transparent hover:text-charcoal'}`}
                    onClick={() => switchAuthMode('otp')}
                    type="button"
                  >
                    <span className="">Mã OTP (Zalo/SMS)</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded-full">Nhanh</span>
                  </button>
                  <button 
                    className={`text-xs font-medium pb-2 border-b-2 transition hidden sm:inline-flex items-center gap-1 ${authMode === 'passkey' ? 'text-terracotta border-terracotta font-bold' : 'text-charcoal-muted border-transparent hover:text-charcoal'}`}
                    onClick={() => switchAuthMode('passkey')}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">fingerprint</span>
                    <span className="">Passkey</span>
                  </button>
                </div>
              </div>

              {/* MAIN LOGIN FORM */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Account / Email Field */}
                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1.5">
                    Email hoặc Tên đăng nhập cơ sở
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-stone-400 text-[20px] pointer-events-none">mail</span>
                    <input 
                      className="w-full pl-11 pr-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl text-sm font-medium text-charcoal placeholder-stone-400 focus-visible:bg-white focus-visible:border-terracotta focus-visible:ring-2 focus-visible:ring-terracotta/20 transition-all outline-none" 
                      id="email-input" 
                      placeholder="quanly@khachsan.vn" 
                      required 
                      type="text"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password Field (Toggled by Auth Mode) */}
                {authMode === 'password' && (
                  <div id="password-section">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-charcoal" htmlFor="password-input">Mật khẩu bảo mật</label>
                      <a className="text-xs font-medium text-terracotta hover:underline" href="#">Quên mật khẩu?</a>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-stone-400 text-[20px] pointer-events-none">lock</span>
                      <input 
                        className="w-full pl-11 pr-11 py-3 bg-stone-50/70 border border-stone-200 rounded-xl text-sm font-medium text-charcoal placeholder-stone-400 focus-visible:bg-white focus-visible:border-terracotta focus-visible:ring-2 focus-visible:ring-terracotta/20 transition-all outline-none" 
                        id="password-input" 
                        placeholder="Nhập mật khẩu" 
                        required 
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        disabled={isLoading}
                      />
                      <button 
                        className="absolute right-3.5 p-1 text-stone-400 hover:text-charcoal transition" 
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                        title="Hiện/ẩn mật khẩu"
                      >
                        <span className="material-symbols-outlined text-[19px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* OTP Section */}
                {authMode === 'otp' && (
                  <div id="otp-section">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-charcoal" htmlFor="otp-input">Mã OTP 6 chữ số</label>
                      <button className="text-xs font-medium text-terracotta hover:underline" type="button">Gửi lại mã (45s)</button>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-stone-400 text-[20px] pointer-events-none">pin</span>
                      <input 
                        className="w-full pl-11 pr-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl text-sm font-medium text-charcoal tracking-widest focus-visible:bg-white focus-visible:border-terracotta focus-visible:ring-2 focus-visible:ring-terracotta/20 transition-all outline-none" 
                        id="otp-input" 
                        maxLength={6} 
                        placeholder="Nhập mã xác thực từ Zalo hoặc SMS" 
                        type="text"
                        value={formData.otp}
                        onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                {/* Passkey Section */}
                {authMode === 'passkey' && (
                  <div id="passkey-section" className="py-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-terracotta/10 flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-[32px] text-terracotta">fingerprint</span>
                    </div>
                    <p className="text-sm text-charcoal-muted mb-2">Sử dụng FaceID, TouchID hoặc Passkey</p>
                    <p className="text-xs text-stone-400">Nhấn nút bên dưới để xác thực sinh trắc học</p>
                  </div>
                )}

                {/* Checkbox Remember / Trusted Device */}
                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      className="w-4 h-4 rounded text-terracotta focus-visible:ring-terracotta accent-terracotta border-stone-300" 
                      type="checkbox" 
                      checked={formData.rememberMe}
                      onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                    />
                    <span className="text-xs font-medium text-charcoal-muted">Lưu phiên làm việc 30 ngày</span>
                  </label>
                  <div className="flex items-center gap-1 text-[11px] text-stone-500 font-medium">
                    <span className="material-symbols-outlined text-[14px] text-emerald-600">verified_user</span>
                    <span className="">Thiết bị an toàn</span>
                  </div>
                </div>

                {/* Submit Primary CTA */}
                <button 
                  className={`w-full py-3.5 px-6 rounded-xl text-white font-bold text-sm tracking-wide shadow-glow-terra hover:shadow-lg transition-all flex items-center justify-center gap-2 group mt-2 ${isLoading ? 'bg-emerald-600' : 'bg-terracotta hover:bg-primary-hover'}`}
                  id="submit-btn" 
                  type="submit"
                  disabled={isLoading}
                >
                  <span id="submit-btn-text">
                    {getSubmitButtonText()}
                  </span>
                  {!isLoading && (
                    <span className="material-symbols-outlined text-[19px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  )}
                  {isLoading && statusMessage.includes('thành công') && (
                    <span className="material-symbols-outlined text-[19px]">check_circle</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* REFINED LUXURY FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400 font-medium z-10">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="">© 2025 DigiStay Technology Systems JSC. Giữ toàn quyền tác quyền.</span>
        </div>
        <div className="flex items-center gap-6">
          <a className="hover:text-charcoal transition" href="#">Điều khoản sử dụng</a>
          <a className="hover:text-charcoal transition" href="#">Chính sách bảo mật dữ liệu</a>
          <a className="hover:text-charcoal transition" href="#">Trung tâm hỗ trợ Đối tác</a>
          <span className="hidden sm:inline text-stone-300">|</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="">Hệ thống ổn định</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
