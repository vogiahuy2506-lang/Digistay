'use client'

import * as React from 'react'
import Link from 'next/link'
import { MaterialSymbol } from '@/components/ui/material-symbol'

export const AuthNav: React.FC = () => {
  return (
    <header className="w-full py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-terracotta-600 flex items-center justify-center shadow-lg">
            <MaterialSymbol name="villa" className="text-2xl text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-white font-bold text-xl">DigiStay</span>
              <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-caps text-label-caps uppercase text-sm">
                SaaS
              </span>
            </div>
            <span className="font-label-caps text-label-caps tracking-widest text-white/60 uppercase hidden sm:block">
              Boutique OS
            </span>
          </div>
        </Link>

        {/* Nav Links - Desktop */}
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="/#features" className="text-white/80 hover:text-white font-medium transition-colors">
            Tính Năng
          </Link>
          <Link href="/pricing" className="text-white/80 hover:text-white font-medium transition-colors">
            Bảng Giá
          </Link>
          <Link href="/contact" className="text-white/80 hover:text-white font-medium transition-colors">
            Liên Hệ
          </Link>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-white/90 font-medium hover:text-white hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
          >
            Đăng Nhập
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-fixed text-on-primary-fixed-variant font-semibold shadow-lg hover:bg-primary-container hover:scale-105 transition-all duration-300"
          >
            <span>Dùng Thử Miễn Phí</span>
            <MaterialSymbol name="arrow_forward" className="text-lg" />
          </Link>
        </div>
      </div>
    </header>
  )
}

export default AuthNav
