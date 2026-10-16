'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from 'framer-motion'

// Icons as SVG components
const Icons = {
  Calendar: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
    </svg>
  ),
  Globe: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2zm0 3.36l1.95 4.57 4.95.42-3.77 3.33 1.16 5.05L12 15.82l-4.29 2.91 1.16-5.05-3.77-3.33 4.95-.42L12 5.36z"/>
    </svg>
  ),
  Lightning: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
    </svg>
  ),
  Users: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Arrow: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
    </svg>
  ),
  Star: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  ),
  Settings: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>
  ),
  Chart: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
    </svg>
  ),
  Code: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
    </svg>
  ),
  Shield: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
    </svg>
  ),
  Phone: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
  ),
  Mail: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>
  ),
  Template: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  ),
  Zap: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  Building: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
    </svg>
  ),
  CreditCard: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
    </svg>
  ),
}

// Color palette - Professional SaaS colors
const colors = {
  primary: '#6366f1',      // Indigo
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  secondary: '#0f172a',    // Dark slate
  tertiary: '#10b981',     // Emerald
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceLight: '#f1f5f9',
  surfaceHigh: '#e2e8f0',
  onSurface: '#1e293b',
  onSurfaceVariant: '#64748b',
  outline: '#cbd5e1',
  accent: '#f59e0b',       // Amber
}

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
}

const fadeInScale = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
}

const slideInLeft = {
  hidden: { opacity: 0, x: -80 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
}

const slideInRight = {
  hidden: { opacity: 0, x: 80 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
}

// Animated Section Component
function AnimatedSection({ children, className = '', variants = fadeInUp }: { children: React.ReactNode, className?: string, variants?: any }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Floating Element
function FloatingElement({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  return (
    <motion.div
      animate={{
        y: [0, -20, 0],
        scale: [1, 1.05, 1]
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  )
}

// Scroll Progress Indicator
function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })
  
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-primary z-[100] origin-left"
      style={{ scaleX }}
    />
  )
}

// Magnetic Button
function MagneticButton({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - rect.width / 2) * 0.4
      const y = (e.clientY - rect.top - rect.height / 2) * 0.4
      setPosition({ x, y })
    }
  }
  
  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }
  
  return (
    <motion.div
      ref={ref}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Feature Card Component
function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:shadow-slate-300/50"
    >
      <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 text-primary">
        <Icon />
      </div>
      <h3 className="text-xl font-bold text-secondary mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  )
}

// Testimonial Card
function TestimonialCard({ name, role, company, content, avatar }: { name: string, role: string, company: string, content: string, avatar: string }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100"
    >
      <div className="flex items-center gap-1 text-amber-400 mb-4">
        {[...Array(5)].map((_, i) => <Icons.Star key={i} />)}
      </div>
      <p className="text-slate-600 mb-6 leading-relaxed">&ldquo;{content}&rdquo;</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primaryLight flex items-center justify-center text-white font-bold">
          {name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-secondary">{name}</p>
          <p className="text-sm text-slate-500">{role} - {company}</p>
        </div>
      </div>
    </motion.div>
  )
}

// Pricing Card
function PricingCard({ name, price, features, isPopular = false }: { name: string, price: string, features: string[], isPopular?: boolean }) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      className={`rounded-2xl p-8 ${isPopular ? 'bg-secondary text-white' : 'bg-white border border-slate-200'}`}
    >
      {isPopular && (
        <span className="inline-block px-3 py-1 bg-primary text-white text-xs font-bold rounded-full mb-4">PHỔ BIẾN NHẤT</span>
      )}
      <h3 className={`text-xl font-bold mb-2 ${isPopular ? 'text-white' : 'text-secondary'}`}>{name}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className={`text-4xl font-bold ${isPopular ? 'text-white' : 'text-secondary'}`}>{price}</span>
        <span className={isPopular ? 'text-slate-300' : 'text-slate-500'}>/tháng</span>
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full ${isPopular ? 'bg-primary' : 'bg-emerald-500'} flex items-center justify-center text-white`}>
              <Icons.Check />
            </div>
            <span className={isPopular ? 'text-slate-200' : 'text-slate-600'}>{feature}</span>
          </li>
        ))}
      </ul>
      <button className={`w-full py-3 rounded-xl font-semibold transition-all ${
        isPopular 
          ? 'bg-primary hover:bg-primaryDark text-white' 
          : 'bg-slate-100 hover:bg-slate-200 text-secondary'
      }`}>
        Bắt đầu ngay
      </button>
    </motion.div>
  )
}

// Stats Counter
function StatCounter({ value, label }: { value: string, label: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className="text-center"
    >
      <div className="text-4xl md:text-5xl font-bold text-primary mb-2">{value}</div>
      <div className="text-slate-600">{label}</div>
    </motion.div>
  )
}

export default function LandingPage() {
  const [email, setEmail] = useState('')
  
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, 150])
  const heroScale = useTransform(scrollY, [0, 500], [1, 1.1])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  
  const navbarBg = useTransform(scrollY, [0, 100], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)'])
  const navbarShadow = useTransform(scrollY, [0, 100], ['none', '0 4px 20px rgba(0,0,0,0.1)'])

  const features = [
    {
      icon: Icons.Calendar,
      title: 'Đặt lịch thông minh',
      description: 'Hệ thống đặt lịch tự động, hỗ trợ nhiều loại dịch vụ, quản lý lịch hẹn dễ dàng.'
    },
    {
      icon: Icons.Globe,
      title: 'Website chuyên nghiệp',
      description: 'Tạo website đẹp, responsive, tối ưu SEO giúp khách hàng dễ dàng tìm thấy bạn.'
    },
    {
      icon: Icons.CreditCard,
      title: 'Thanh toán trực tuyến',
      description: 'Tích hợp thanh toán online, quản lý hóa đơn và giao dịch tự động.'
    },
    {
      icon: Icons.Chart,
      title: 'Báo cáo chi tiết',
      description: 'Theo dõi doanh thu, lịch hẹn, khách hàng với biểu đồ trực quan và chi tiết.'
    },
    {
      icon: Icons.Settings,
      title: 'Quản lý dễ dàng',
      description: 'Giao diện quản trị trực quan, quản lý phòng, dịch vụ, nhân viên hiệu quả.'
    },
    {
      icon: Icons.Shield,
      title: 'Bảo mật cao cấp',
      description: 'Dữ liệu được mã hóa, backup tự động, đảm bảo an toàn thông tin tuyệt đối.'
    }
  ]

  const testimonials = [
    {
      name: 'Nguyễn Thị Lan',
      role: 'Chủ spa',
      company: 'Spa Minh Châu',
      content: 'Từ khi dùng Digistay, khách hàng đặt lịch tăng 200%. Tôi tiết kiệm được 3 tiếng mỗi ngày để quản lý lịch hẹn.',
      avatar: 'NL'
    },
    {
      name: 'Trần Văn Minh',
      role: 'Quản lý khách sạn',
      company: 'Khách Sạn Phương Nam',
      content: 'Website đẹp, dễ sử dụng, khách đặt phòng tăng rõ rệt. Đội ngũ hỗ trợ rất nhiệt tình.',
      avatar: 'TM'
    },
    {
      name: 'Lê Hoàng Anh',
      role: 'Giám đốc',
      company: 'Clinic Thẩm Mỹ Venus',
      content: 'Giải pháp toàn diện cho việc quản lý clinic. Đặc biệt tính năng thanh toán online rất tiện lợi.',
      avatar: 'LA'
    }
  ]

  const pricingPlans = [
    {
      name: 'Starter',
      price: '499K',
      features: [
        '1 website',
        '100 lượt đặt/tháng',
        '1 quản trị viên',
        'Hỗ trợ email',
        'Báo cáo cơ bản'
      ]
    },
    {
      name: 'Professional',
      price: '999K',
      isPopular: true,
      features: [
        '1 website cao cấp',
        'Không giới hạn đặt lịch',
        '5 quản trị viên',
        'Thanh toán online',
        'Hỗ trợ 24/7',
        'Báo cáo nâng cao'
      ]
    },
    {
      name: 'Enterprise',
      price: '2.9M',
      features: [
        'Nhiều website',
        'Không giới hạn',
        'Không giới hạn users',
        'API riêng',
        'Thiết kế theo yêu cầu',
        'Quản lý nâng cao'
      ]
    }
  ]

  const steps = [
    {
      number: '01',
      title: 'Đăng ký tài khoản',
      description: 'Đăng ký nhanh chóng với email và bắt đầu dùng thử miễn phí 14 ngày.'
    },
    {
      number: '02',
      title: 'Tùy chỉnh website',
      description: 'Chọn giao diện, thêm dịch vụ, thiết lập lịch làm việc theo ý bạn.'
    },
    {
      number: '03',
      title: 'Chia sẻ với khách hàng',
      description: 'Nhận link website để chia sẻ, khách hàng có thể đặt lịch ngay.'
    }
  ]

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <ScrollProgress />
      
      {/* Navbar */}
      <motion.header
        style={{ backgroundColor: navbarBg, boxShadow: navbarShadow }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center">
                <Icons.Calendar />
                <span className="text-white font-bold text-lg ml-1">D</span>
              </div>
              <span className="text-2xl font-bold text-secondary">Digistay</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-primary transition-colors font-medium">Tính năng</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-primary transition-colors font-medium">Cách hoạt động</a>
              <a href="#pricing" className="text-slate-600 hover:text-primary transition-colors font-medium">Bảng giá</a>
              <a href="#testimonials" className="text-slate-600 hover:text-primary transition-colors font-medium">Đánh giá</a>
            </nav>
            
            <div className="flex items-center gap-4">
              <Link href="/login" className="hidden sm:block text-slate-600 hover:text-primary transition-colors font-medium">
                Đăng nhập
              </Link>
              <MagneticButton>
                <Link href="/register" className="bg-primary hover:bg-primaryDark text-white px-5 py-2.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-indigo-300/50">
                  Dùng thử miễn phí
                </Link>
              </MagneticButton>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-emerald-50" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-0 w-[500px] h-[500px] bg-tertiary/5 rounded-full blur-3xl" />
        
        <motion.div 
          style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 bg-indigo-50 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6"
              >
                <Icons.Lightning />
                <span>Hơn 10,000+ doanh nghiệp đang sử dụng</span>
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-secondary leading-tight mb-6"
              >
                Nền tảng tạo website
                <span className="text-primary"> đặt lịch </span>
                chuyên nghiệp
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0"
              >
                Giúp bạn tạo website đặt lịch hẹn, quản lý dịch vụ, thanh toán trực tuyến 
                chỉ trong vài phút. Không cần biết lập trình.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <MagneticButton>
                  <Link href="/register" className="bg-primary hover:bg-primaryDark text-white px-8 py-4 rounded-xl font-semibold transition-all hover:shadow-xl hover:shadow-indigo-300/50 flex items-center justify-center gap-2 text-lg">
                    Bắt đầu miễn phí
                    <Icons.Arrow />
                  </Link>
                </MagneticButton>
                <button className="border-2 border-slate-200 hover:border-primary text-slate-700 hover:text-primary px-8 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                  Xem demo
                </button>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mt-8 flex items-center gap-6 justify-center lg:justify-start"
              >
                <div className="flex -space-x-3">
                  {['JK', 'ML', 'TN', 'PH'].map((initials, i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primaryLight border-2 border-white flex items-center justify-center text-white text-xs font-bold">
                      {initials}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => <Icons.Star key={i} />)}
                  </div>
                  <p className="text-sm text-slate-600">4.9/5 từ 2,000+ đánh giá</p>
                </div>
              </motion.div>
            </div>
            
            {/* Hero Image/Preview */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative"
            >
              <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-300/50 p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                {/* Mock website preview */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-32 h-6 bg-primary/20 rounded" />
                    <div className="flex gap-4">
                      <div className="w-16 h-4 bg-slate-300 rounded" />
                      <div className="w-16 h-4 bg-slate-300 rounded" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="w-full h-20 bg-slate-200 rounded-lg mb-2" />
                        <div className="w-3/4 h-4 bg-slate-300 rounded mb-1" />
                        <div className="w-1/2 h-3 bg-slate-200 rounded" />
                      </div>
                    ))}
                  </div>
                  <div className="bg-primary text-white text-center py-3 rounded-lg font-medium">
                    Đặt lịch ngay
                  </div>
                </div>
              </div>
              
              {/* Floating elements */}
              <FloatingElement delay={0}>
                <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-3 flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                    <Icons.Check />
                  </div>
                  <span className="text-sm font-medium text-secondary">Đặt lịch thành công!</span>
                </div>
              </FloatingElement>
              
              <FloatingElement delay={0.5}>
                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-3 flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                    <Icons.Calendar />
                  </div>
                  <span className="text-sm font-medium text-secondary">Lịch hẹn mới</span>
                </div>
              </FloatingElement>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCounter value="10,000+" label="Doanh nghiệp" />
            <StatCounter value="1M+" label="Lượt đặt lịch" />
            <StatCounter value="99.9%" label="Uptime" />
            <StatCounter value="4.9/5" label="Đánh giá" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block text-primary font-semibold text-sm tracking-wider uppercase mb-4">Tính năng</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-secondary mb-6">
              Mọi thứ bạn cần để quản lý đặt lịch
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Digistay cung cấp giải pháp toàn diện giúp bạn tạo website, quản lý lịch hẹn 
              và thanh toán một cách dễ dàng.
            </p>
          </AnimatedSection>
          
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works Section */}
      <section id="how-it-works" className="py-20 md:py-32 bg-gradient-to-br from-secondary to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block text-primaryLight font-semibold text-sm tracking-wider uppercase mb-4">Cách hoạt động</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Tạo website trong 3 bước đơn giản
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Không cần biết lập trình. Chỉ cần vài phút để có website đặt lịch chuyên nghiệp.
            </p>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <AnimatedSection key={i} variants={slideInRight} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-gradient-to-r from-primaryLight to-transparent" />
                )}
                <div className="text-7xl font-bold text-primaryLight/20 mb-4">{step.number}</div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-300 leading-relaxed">{step.description}</p>
              </AnimatedSection>
            ))}
          </div>
          
          <AnimatedSection className="mt-16 text-center">
            <MagneticButton>
              <Link href="/register" className="bg-primary hover:bg-primaryDark text-white px-8 py-4 rounded-xl font-semibold transition-all hover:shadow-xl hover:shadow-indigo-500/30 inline-flex items-center gap-2">
                Bắt đầu ngay
                <Icons.Arrow />
              </Link>
            </MagneticButton>
          </AnimatedSection>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block text-primary font-semibold text-sm tracking-wider uppercase mb-4">Đánh giá</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-secondary mb-6">
              Khách hàng nói gì về Digistay
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Hàng nghìn doanh nghiệp đã tin tưởng sử dụng Digistay để phát triển dịch vụ của họ.
            </p>
          </AnimatedSection>
          
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-3 gap-8"
          >
            {testimonials.map((testimonial, i) => (
              <TestimonialCard key={i} {...testimonial} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block text-primary font-semibold text-sm tracking-wider uppercase mb-4">Bảng giá</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-secondary mb-6">
              Chọn gói phù hợp với bạn
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Giá cả hợp lý, không phí ẩn. Dùng thử miễn phí 14 ngày.
            </p>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <PricingCard key={i} {...plan} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary to-primaryDark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              Sẵn sàng tạo website của bạn?
            </h2>
            <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
              Bắt đầu dùng thử miễn phí 14 ngày. Không cần thẻ tín dụng.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <MagneticButton>
                <Link href="/register" className="bg-white text-primary hover:bg-slate-100 px-8 py-4 rounded-xl font-semibold transition-all hover:shadow-xl inline-flex items-center justify-center gap-2 text-lg">
                  Dùng thử miễn phí
                  <Icons.Arrow />
                </Link>
              </MagneticButton>
              <a href="#pricing" className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-4 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-2">
                Xem bảng giá
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primaryLight flex items-center justify-center">
                  <Icons.Calendar />
                </div>
                <span className="text-2xl font-bold">Digistay</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Nền tảng tạo website đặt lịch hàng đầu Việt Nam. Giúp doanh nghiệp số hóa dịch vụ một cách dễ dàng.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Sản phẩm</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">Tính năng</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Bảng giá</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Template</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Hỗ trợ</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Trung tâm trợ giúp</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Liên hệ</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Hướng dẫn sử dụng</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Câu hỏi thường gặp</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Liên hệ</h4>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-center gap-2">
                  <Icons.Mail />
                  <span>contact@digistay.vn</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icons.Phone />
                  <span>1900 1234</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © 2024 Digistay. Tất cả quyền được bảo lưu.
            </p>
            <div className="flex gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Điều khoản sử dụng</a>
              <a href="#" className="hover:text-white transition-colors">Chính sách bảo mật</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
