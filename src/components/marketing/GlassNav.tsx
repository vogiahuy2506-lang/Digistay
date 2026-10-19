'use client'

import * as React from 'react'
import Link from 'next/link'

const LogoIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="12" fill="url(#logoGrad)"/>
    <path d="M20 8L12 14V26L20 32L28 26V14L20 8Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M20 18V32M12 14L20 20L28 14" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f97316"/>
        <stop offset="1" stopColor="#dc2626"/>
      </linearGradient>
    </defs>
  </svg>
)

interface GlassNavProps {
  variant?: 'solid' | 'blur'
}

export const GlassNav: React.FC<GlassNavProps> = ({ variant = 'blur' }) => {
  const baseClasses = variant === 'blur'
    ? 'bg-white/10 backdrop-blur-xl border-b border-white/20'
    : 'bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-xl border-b border-white/10'

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 ${baseClasses}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <LogoIcon />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-xl tracking-tight">DigiStay</span>
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold uppercase tracking-wider">
                  SaaS
                </span>
              </div>
              <span className="text-white/60 text-xs uppercase tracking-widest hidden sm:block">
                Boutique OS
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-10">
            <NavLink href="/#features">Tính Năng</NavLink>
            <NavLink href="/#templates">Mẫu Giao Diện</NavLink>
            <NavLink href="/pricing">Bảng Giá</NavLink>
            <NavLink href="/contact">Liên Hệ</NavLink>
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden sm:flex items-center justify-center px-5 py-2.5 rounded-xl text-white/90 font-medium hover:text-white hover:bg-white/10 transition-all duration-300"
            >
              Đăng Nhập
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all duration-300"
            >
              <span>Dùng Thử Miễn Phí</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="xl:hidden p-2 rounded-lg bg-white/10 text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

const NavLink: React.FC<{ href: string; children: React.ReactNode}> = ({ href, children }) => (
  <a
    href={href}
    className="text-white/80 font-medium hover:text-white transition-colors duration-200 relative group"
  >
    {children}
    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400 group-hover:w-full transition-all duration-300" />
  </a>
)

export default GlassNav
