'use client'

import * as React from 'react'
import Link from 'next/link'

const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="12" fill="url(#logoGradFooter)"/>
    <path d="M20 8L12 14V26L20 32L28 26V14L20 8Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M20 18V32M12 14L20 20L28 14" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
    <defs>
      <linearGradient id="logoGradFooter" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f97316"/>
        <stop offset="1" stopColor="#dc2626"/>
      </linearGradient>
    </defs>
  </svg>
)

const footerLinks = {
  product: {
    title: 'Sản Phẩm',
    links: [
      { label: 'Tính Năng', href: '/#features' },
      { label: 'Bảng Giá', href: '/pricing' },
      { label: 'Mẫu Giao Diện', href: '/#templates' },
      { label: 'Cập Nhật', href: '/changelog' },
    ],
  },
  company: {
    title: 'Công Ty',
    links: [
      { label: 'Giới Thiệu', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Tuyển Dụng', href: '/careers' },
      { label: 'Liên Hệ', href: '/contact' },
    ],
  },
  resources: {
    title: 'Tài Nguyên',
    links: [
      { label: 'Trung Tâm Trợ Giúp', href: '/help' },
      { label: 'Tài Liệu API', href: '/docs' },
      { label: 'Hướng Dẫn', href: '/guides' },
      { label: 'Diễn Đàn', href: '/forum' },
    ],
  },
  legal: {
    title: 'Pháp Lý',
    links: [
      { label: 'Điều Khoản Dịch Vụ', href: '/terms' },
      { label: 'Chính Sách Bảo Mật', href: '/privacy' },
      { label: 'Chính Sách Cookie', href: '/cookies' },
    ],
  },
}

const socialLinks = [
  { name: 'Facebook', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', href: '#' },
  { name: 'YouTube', icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', href: '#' },
  { name: 'Zalo', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-6h2v2h-2zm0-8h2v6h-2z', href: '#' },
]

export const GlassFooter: React.FC = () => {
  return (
    <footer className="relative bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Decorative top border with gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-16 pb-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12 pb-12 border-b border-white/10">
          {/* Brand Column */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <LogoIcon />
              <span className="text-white font-bold text-xl">DigiStay</span>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs mb-6">
              Nền tảng quản lý khách sạn boutique hàng đầu Việt Nam. Giúp bạn xây dựng kênh bán phòng độc quyền với chi phí 0% hoa hồng.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  aria-label={social.name}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d={social.icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key} className="col-span-1">
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-white/50 text-sm hover:text-orange-400 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">
            © 2026 DigiStay. Tất cả quyền được bảo lưu.
          </p>
          
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/50 text-sm">Tất cả hệ thống hoạt động bình thường</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default GlassFooter
