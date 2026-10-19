'use client'

import * as React from 'react'

export const GradientBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950" />
      
      {/* Animated gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-orange-500/30 via-red-500/20 to-transparent rounded-full blur-3xl animate-morph-1" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-transparent rounded-full blur-3xl animate-morph-2" />
      <div className="absolute bottom-0 left-0 w-[700px] h-[700px] bg-gradient-to-tr from-red-600/25 via-orange-500/20 to-transparent rounded-full blur-3xl animate-morph-3" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-tl from-amber-400/15 via-orange-400/10 to-transparent rounded-full blur-3xl animate-morph-2" />
      
      {/* Mesh grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }}
      />
      
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
      }} />
    </div>
  )
}

export const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'highlight' | 'dark'
}> = ({ children, className = '', variant = 'default' }) => {
  const variantClasses = {
    default: 'bg-white/5 backdrop-blur-xl border border-white/10',
    highlight: 'bg-gradient-to-br from-orange-500/10 to-red-500/5 backdrop-blur-xl border border-orange-500/20',
    dark: 'bg-slate-900/50 backdrop-blur-xl border border-white/5',
  }
  
  return (
    <div className={`rounded-2xl ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  )
}

export const GradientButton: React.FC<{
  children: React.ReactNode
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  icon?: React.ReactNode
}> = ({ children, href, onClick, variant = 'primary', size = 'md', className = '', icon }) => {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  }
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105',
    secondary: 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30',
    outline: 'bg-transparent text-white border border-white/30 hover:bg-white/10 hover:border-white/50',
  }
  
  const baseClasses = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-300 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`
  
  if (href) {
    return (
      <a href={href} className={baseClasses}>
        {children}
        {icon}
      </a>
    )
  }
  
  return (
    <button onClick={onClick} className={baseClasses}>
      {children}
      {icon}
    </button>
  )
}

export const GlassInput: React.FC<{
  label?: string
  placeholder?: string
  type?: string
  className?: string
}> = ({ label, placeholder, type = 'text', className = '' }) => (
  <div className={className}>
    {label && (
      <label className="block text-white/80 text-sm font-medium mb-2">
        {label}
      </label>
    )}
    <input
      type={type}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all duration-300"
    />
  </div>
)

export default GradientBackground
