'use client'

import * as React from 'react'
import Link from 'next/link'
import { MaterialSymbol } from '@/components/ui/material-symbol'

const footerLinks = {
  product: {
    title: 'Sản Phẩm',
    links: [
      { label: 'Tính Năng', href: '/#features' },
      { label: 'Bảng Giá', href: '/pricing' },
      { label: 'Mẫu Giao Diện', href: '/#templates' },
    ],
  },
  company: {
    title: 'Công Ty',
    links: [
      { label: 'Giới Thiệu', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Liên Hệ', href: '/contact' },
    ],
  },
  resources: {
    title: 'Tài Nguyên',
    links: [
      { label: 'Trung Tâm Trợ Giúp', href: '/help' },
      { label: 'Tài Liệu API', href: '/docs' },
      { label: 'Hướng Dẫn', href: '/guides' },
    ],
  },
  legal: {
    title: 'Pháp Lý',
    links: [
      { label: 'Điều Khoản Dịch Vụ', href: '/terms' },
      { label: 'Chính Sách Bảo Mật', href: '/privacy' },
    ],
  },
}

const socialLinks = [
  { name: 'Facebook', href: '#', icon: 'share' },
  { name: 'YouTube', href: '#', icon: 'smart_display' },
  { name: 'Zalo', href: '#', icon: 'chat' },
]

export const AuthFooter: React.FC = () => {
  return (
    <footer className="w-full mt-20 bg-gradient-to-b from-transparent to-black/20 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 pb-12 border-b border-white/10">
          {/* Brand Column */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-terracotta-600 flex items-center justify-center">
                <MaterialSymbol name="villa" className="text-lg text-white" />
              </div>
              <span className="text-white font-bold text-lg">DigiStay</span>
            </Link>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-6">
              Nền tảng quản lý khách sạn boutique hàng đầu Việt Nam. Giúp bạn xây dựng kênh bán phòng độc quyền với chi phí 0% hoa hồng.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
                  aria-label={social.name}
                >
                  <MaterialSymbol name={social.icon} className="text-xl" />
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
                      className="text-white/50 text-sm hover:text-white transition-colors duration-200"
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

export default AuthFooter
