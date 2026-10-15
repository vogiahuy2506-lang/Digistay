'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from 'framer-motion'

// Icons as SVG components
const Icons = {
  Spa: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
  Lock: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  ),
  Location: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  ),
  Calendar: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  ),
  Star: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  ),
  Arrow: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
    </svg>
  ),
  Bed: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/>
    </svg>
  ),
  Eye: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  ),
  Area: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    </svg>
  ),
  Camera: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="3.2"/>
      <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    </svg>
  ),
  Landscape: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22z"/>
    </svg>
  ),
  Plant: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 22c4.97 0 9-4.03 9-9-4.97 0-9 4.03-9 9zM5.6 10.25c0 1.38 1.12 2.5 2.5 2.5.53 0 1.01-.16 1.42-.44l-.02.19c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5l-.02-.19c.4.28.89.44 1.42.44 1.38 0 2.5-1.12 2.5-2.5 0-1-.59-1.85-1.43-2.25.84-.4 1.43-1.25 1.43-2.25 0-1.38-1.12-2.5-2.5-2.5-.53 0-1.01.16-1.42.44l.02-.19C14.5 3.62 13.38 2.5 12 2.5S9.5 3.62 9.5 5l.02.19c-.4-.28-.89-.44-1.42-.44-1.38 0-2.5 1.12-2.5 2.5 0 1 .59 1.85 1.43 2.25-.84.4-1.43 1.25-1.43 2.25z"/>
    </svg>
  ),
  SelfImprovement: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm1 10H8v3H5v-3H2v-2h3V8h2v3h3v2z"/>
    </svg>
  ),
  QrCode: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v2h2v2h-2v2h2v-2h2v2h2v-2h-2v-2h2v-2h-2v2h-2v-2h2zm0 4h-2v2h2v-2z"/>
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Chevron: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
    </svg>
  ),
  Support: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
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
  Verified: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
  ),
  Terrace: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22z"/>
    </svg>
  ),
}

// Color palette
const colors = {
  primary: '#a93119',
  primaryLight: '#cb492f',
  primaryDark: '#8b1b05',
  secondary: '#545f73',
  tertiary: '#2a674c',
  background: '#fbf9f6',
  surface: '#efeeeb',
  surfaceLight: '#f5f3f0',
  surfaceHigh: '#eae8e5',
  onSurface: '#1b1c1a',
  onSurfaceVariant: '#59413c',
  outline: '#8c716b',
  outlineVariant: '#e0bfb8',
  tertiaryLight: '#448064',
  tertiaryBg: '#b1f0ce',
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

// Parallax Image Component
function ParallaxImage({ src, alt, className }: { src: string, alt: string, className?: string }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  })
  
  const y = useTransform(scrollYProgress, [0, 1], [50, -50])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1.2, 1.1])
  
  return (
    <motion.div ref={ref} style={{ y }} className="overflow-hidden">
      <motion.div style={{ scale }} className="relative w-full h-full">
        <Image src={src} alt={alt} fill className={`object-cover ${className}`} />
      </motion.div>
    </motion.div>
  )
}

// Floating Element
function FloatingElement({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  return (
    <motion.div
      animate={{
        y: [0, -20, 0],
        scale: [1, 1.1, 1],
        rotate: [0, 3, -3, 0]
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  )
}

// Zoom Reveal Element - zooms in from far to normal
function ZoomReveal({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.3, y: 100 }}
      animate={isInView ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.3, y: 100 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className={className}
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

// Tilt Card Effect
function TiltCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateXValue = ((y - centerY) / centerY) * -15
      const rotateYValue = ((x - centerX) / centerX) * 15
      setRotateX(rotateXValue)
      setRotateY(rotateYValue)
    }
  }
  
  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }
  
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ perspective: 1000 }}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  )
}

// Reveal Text Animation
function RevealText({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  
  return (
    <span ref={ref} className="inline-block overflow-hidden">
      <motion.span
        className="inline-block"
        initial={{ y: '100%' }}
        animate={isInView ? { y: 0 } : { y: '100%' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </span>
  )
}

// Morphing Shape Background
function MorphingShapes() {
  // Use deterministic positions instead of Math.random() to avoid hydration mismatch
  const particlePositions = [
    { left: '10%', top: '20%' },
    { left: '25%', top: '60%' },
    { left: '40%', top: '30%' },
    { left: '55%', top: '70%' },
    { left: '70%', top: '15%' },
    { left: '85%', top: '45%' },
    { left: '15%', top: '80%' },
    { left: '30%', top: '10%' },
    { left: '60%', top: '85%' },
    { left: '75%', top: '55%' },
    { left: '90%', top: '25%' },
    { left: '5%', top: '50%' },
    { left: '45%', top: '90%' },
    { left: '80%', top: '75%' },
    { left: '20%', top: '40%' },
    { left: '50%', top: '5%' },
    { left: '35%', top: '75%' },
    { left: '65%', top: '35%' },
    { left: '95%', top: '65%' },
    { left: '12%', top: '92%' },
  ]
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.svg
        className="absolute w-[800px] h-[800px]"
        style={{ top: '-10%', left: '-20%' }}
        viewBox="0 0 100 100"
      >
        <motion.path
          d="M50 10 C70 10, 90 30, 90 50 C90 70, 70 90, 50 90 C30 90, 10 70, 10 50 C10 30, 30 10, 50 10"
          fill={`${colors.primary}08`}
          animate={{
            d: [
              "M50 10 C70 10, 90 30, 90 50 C90 70, 70 90, 50 90 C30 90, 10 70, 10 50 C10 30, 30 10, 50 10",
              "M50 20 C80 15, 95 35, 90 55 C85 80, 65 95, 45 90 C20 85, 5 60, 15 35 C25 15, 40 20, 50 20",
              "M50 10 C70 10, 90 30, 90 50 C90 70, 70 90, 50 90 C30 90, 10 70, 10 50 C10 30, 30 10, 50 10"
            ]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </motion.svg>
      
      <motion.svg
        className="absolute w-[600px] h-[600px]"
        style={{ bottom: '-15%', right: '-10%' }}
        viewBox="0 0 100 100"
      >
        <motion.path
          d="M50 10 L90 50 L50 90 L10 50 Z"
          fill={`${colors.tertiary}08`}
          animate={{
            d: [
              "M50 10 L90 50 L50 90 L10 50 Z",
              "M50 20 L85 45 L55 85 L15 55 Z",
              "M50 10 L90 50 L50 90 L10 50 Z"
            ],
            rotate: [0, 180]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
      </motion.svg>
      
      {/* Floating particles */}
      {particlePositions.map((pos, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: i % 2 === 0 ? colors.primary : colors.tertiary,
            left: pos.left,
            top: pos.top,
            opacity: 0.3
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, (i % 2 === 0 ? 25 : -25), 0],
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.5, 0.2]
          }}
          transition={{
            duration: 5 + (i % 5),
            repeat: Infinity,
            delay: (i % 5)
          }}
        />
      ))}
    </div>
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

export default function LandingPage() {
  const [countdown, setCountdown] = useState({ minutes: 13, seconds: 53 })
  const [email, setEmail] = useState('')
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, 150])
  const heroScale = useTransform(scrollY, [0, 500], [1, 1.1])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  
  const navbarBg = useTransform(scrollY, [0, 100], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)'])
  const navbarShadow = useTransform(scrollY, [0, 100], ['none', '0 4px 20px rgba(0,0,0,0.1)'])
  
  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev.minutes === 0 && prev.seconds === 0) return prev
        if (prev.seconds === 0) return { minutes: prev.minutes - 1, seconds: 59 }
        return { ...prev, seconds: prev.seconds - 1 }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const roomTypes = [
    {
      id: 1,
      name: 'Deluxe King View Thung Lũng',
      size: 30,
      bed: '1 King Bed',
      view: 'View Thung Lũng',
      price: '800.000₫',
      badge: 'Bán Chạy Nhất',
      badgeColor: colors.primary,
      images: 6,
      description: 'Trải nghiệm ngâm bồn tắm gỗ Pơ-mu ngắm nhìn biển mây Mường Hoa trôi bồng bềnh ngay trước tầm mắt.',
      imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80'
    },
    {
      id: 2,
      name: 'Executive Suite Garden View',
      size: 48,
      bed: 'Ban công riêng',
      view: 'Bể sục Jacuzzi',
      price: '1.200.000₫',
      badge: 'Yêu Thích Cho Cặp Đôi',
      badgeColor: colors.tertiary,
      images: 8,
      description: 'Không gian tĩnh tại với ban công gỗ mở rộng đón nắng sớm, bồn sục Jacuzzi sưởi ấm thảo mộc riêng biệt.',
      imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80'
    },
    {
      id: 3,
      name: 'Family Pool Villa Biệt Lập',
      size: 120,
      bed: 'Bể nước ấm 4 mùa',
      view: 'Quản gia riêng',
      price: '3.450.000₫',
      badge: 'Villa Biệt Lập Sang Trọng',
      badgeColor: '#30312f',
      images: 12,
      description: 'Đặc quyền riêng tư tuyệt đối cho gia đình. Biệt thự 2 phòng ngủ với hồ bơi nước ấm vô cực riêng.',
      imageUrl: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=600&q=80'
    },
  ]

  const pillars = [
    { icon: Icons.Landscape, number: '01', title: 'Không Gian', subtitle: 'Chữa Lành Riêng Tư', description: '100% phòng sở hữu tầm nhìn không che chắn ôm trọn thung lũng mây bồng bềnh và rừng thông ngút ngàn.', bgColor: '#d8e3fb', iconColor: colors.secondary },
    { icon: Icons.Plant, number: '02', title: 'Nông Trại', subtitle: 'Ẩm Thực Farm-to-Table', description: 'Thực đơn món ăn theo mùa từ vườn rau hữu cơ ngay tại retreat cùng nông sản thổ nhưỡng vùng cao.', bgColor: colors.tertiaryBg, iconColor: colors.tertiary },
    { icon: Icons.SelfImprovement, number: '03', title: 'Thảo Mộc', subtitle: 'Spa Bản Địa Độc Quyền', description: 'Liệu trình tắm thùng gỗ Pơ-mu với 36 vị lá thuốc Dao Đỏ trứ danh, xông tinh dầu thông rừng tự nhiên.', bgColor: '#ffb4a4', iconColor: colors.primary },
    { icon: Icons.QrCode, number: '04', title: 'Công Nghệ', subtitle: 'Đặt Phòng DigiStay 4.0', description: 'Check-in số không chạm, khóa phòng tạm 15 phút tránh trùng phòng, tích hợp VietQR chuyển khoản định danh.', bgColor: colors.surfaceHigh, iconColor: colors.primary },
  ]

  const experiences = [
    { number: '01', time: 'Buổi Sáng', title: 'Trekking Ruộng Bậc Thang', description: 'Băng qua rừng trúc và ruộng bậc thang ngắm bình minh cùng người dẫn đường bản địa.', imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80' },
    { number: '02', time: 'Chiều Tà', title: 'Trà Chiều Shan Tuyết Cổ Thụ', description: 'Thưởng thức hương vị trà cổ thụ hàng trăm năm tuổi trên sàn mây lộng gió.', imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&q=80' },
    { number: '03', time: 'Hoàng Hôn', title: 'Tiệc Nướng BBQ Bên Suối', description: 'Tiệc nướng than hoa ướp hạt mắc khén và hạt dổi rừng bên suối trong róc rách.', imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80' },
    { number: '04', time: 'Đêm Trăng', title: 'Lửa Trại & Tiếng Sáo H\'Mông', description: 'Lắng đọng quanh đốm lửa bập bùng, nghe giai điệu sáo Mèo da diết và câu chuyện vùng cao.', imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80' },
  ]

  const reviews = [
    { name: 'Chị Mai Phương', location: 'Hà Nội', rating: 5, title: 'Kỳ nghỉ chữa lành đích thực sau 6 tháng kiệt sức', content: 'Tôi tìm đến DigiStay sau chuỗi ngày áp lực công việc. Thức dậy với tiếng suối và mùi gỗ thông thoang thoảng khiến mọi căng thẳng tan biến.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80' },
    { name: 'Anh Quốc Huy', location: 'TP. Hồ Chí Minh', rating: 5, title: 'Cả gia đình đều say mê bữa ăn Farm-to-Table', content: 'Rau cải mèo và su su ngọt lịm vừa hái tại vườn. Hai bé nhà mình được tự tay hái dâu và cho thỏ ăn trong khuôn viên.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80' },
    { name: 'Vợ chồng Hà & Nam', location: 'Đà Nẵng', rating: 5, title: 'Kỷ niệm ngày cưới hoàn hảo không thể quên', content: 'Họ chuẩn bị cho vợ chồng mình một bàn tiệc nướng nến lung linh bên bờ suối. Check-in qua VietQR quét mã một giây là xong.', avatar: 'https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?w=100&q=80' },
  ]

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Scroll Progress Bar */}
      <ScrollProgress />
      
      {/* Morphing Background Shapes */}
      <MorphingShapes />
      
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{ 
            background: `radial-gradient(circle, ${colors.primary}15, transparent)`,
            top: '10%',
            left: '-15%'
          }}
          animate={{
            x: [0, 80, 0],
            y: [0, 50, 0],
            scale: [1, 1.3, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ 
            background: `radial-gradient(circle, ${colors.tertiary}12, transparent)`,
            bottom: '20%',
            right: '-10%'
          }}
          animate={{
            x: [0, -60, 0],
            y: [0, -80, 0],
            scale: [1, 1.4, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* ================= TOP NOTIFICATION BAR ================= */}
      <motion.div 
        className="bg-primary text-white py-2.5 px-4 relative z-50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative flex h-3 w-3">
              <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></div>
              <div className="relative inline-flex rounded-full h-3 w-3 bg-white"></div>
            </div>
            <div className="flex items-center gap-2">
              <Icons.Lock />
              <p className="text-sm font-medium">
                <span className="font-bold">Phòng Deluxe King View Thung Lũng</span> đang được giữ tạm thời:
                <motion.span 
                  className="inline-block bg-black/20 font-bold px-2 py-0.5 rounded ml-2 tracking-widest"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                </motion.span>
              </p>
            </div>
          </motion.div>
          <motion.div 
            className="flex items-center gap-4 text-xs text-white/90"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <span className="hidden sm:inline-flex items-center gap-1 bg-white/10 px-2.5 py-0.5 rounded-full">
              <Icons.Verified />
              Hệ thống đang khóa tạm thời trên Booking.com & Agoda
            </span>
            <span className="hidden md:inline text-white/60">|</span>
            <span className="hidden md:inline">Tránh trùng lịch đặt phòng 100%</span>
          </motion.div>
        </div>
      </motion.div>

      {/* ================= NAVIGATION ================= */}
      <motion.nav 
        className="sticky top-0 z-40 px-4 lg:px-8 py-3.5"
        style={{ 
          backgroundColor: navbarBg,
          boxShadow: navbarShadow
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md">
              <Icons.Spa />
            </div>
            <div>
              <span className="block font-extrabold text-xl tracking-tight text-primary uppercase">DIGISTAY</span>
              <span className="block text-[10px] tracking-widest uppercase text-secondary font-medium">Smart Hospitality</span>
            </div>
          </motion.div>

          {/* Desktop Nav */}
          <motion.div 
            className="hidden xl:flex items-center gap-8 text-sm font-medium text-onSurfaceVariant"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {['Trang chủ', 'Hạng phòng & Bảng giá', 'Dịch vụ & Ẩm thực', 'Ưu đãi & Trải nghiệm'].map((item, i) => (
              <motion.a
                key={item}
                href="#"
                className="hover:text-primary transition-colors relative"
                whileHover={{ y: -2 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                {item}
                <motion.span 
                  className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary"
                  whileHover={{ width: '100%' }}
                  transition={{ duration: 0.3 }}
                />
              </motion.a>
            ))}
          </motion.div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <motion.div 
              className="hidden lg:flex items-center gap-2 pl-3 border-l border-outlineVariant"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="w-8 h-8 rounded-full bg-tertiaryBg flex items-center justify-center" style={{ color: colors.tertiary }}>
                <Icons.Support />
              </div>
              <div>
                <p className="text-[11px] text-secondary font-medium leading-none">Hotline 24/7</p>
                <p className="text-xs font-bold mt-0.5">0988 123 456</p>
              </div>
            </motion.div>

            <MagneticButton>
              <motion.a 
                href="#rooms" 
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-md"
                whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(169, 49, 25, 0.4)' }}
                whileTap={{ scale: 0.98 }}
              >
                Đặt Phòng Ngay
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Icons.Arrow />
                </motion.span>
              </motion.a>
            </MagneticButton>

            <motion.a
              href="/login"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-white transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icons.Lock />
              Đăng Nhập
            </motion.a>
          </div>
        </div>
      </motion.nav>

      {/* ================= HERO SECTION ================= */}
      <section className="relative overflow-hidden rounded-b-[3rem]">
        {/* Background with Zoom Effect */}
        <motion.div 
          className="absolute inset-0"
          style={{ y: heroY, scale: heroScale }}
        >
          <Image
            src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&q=80"
            alt="DigiStay Resort"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
        </motion.div>

        {/* Hero Content */}
        <motion.div 
          className="relative z-10 px-6 sm:px-12 lg:px-20 pt-20 pb-32 max-w-6xl mx-auto text-center"
          style={{ opacity: heroOpacity }}
        >
          {/* Rating Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 backdrop-blur-sm shadow-lg mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.03 }}
          >
            <span className="text-primary font-bold flex items-center gap-1">
              <Icons.Star />
              4.95 / 5.0
            </span>
            <span className="w-1 h-1 rounded-full bg-outlineVariant"></span>
            <span className="text-sm text-onSurfaceVariant">Hơn 1,200+ đánh giá</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: colors.tertiary, backgroundColor: colors.tertiaryBg }}>
              <Icons.Verified /> Eco-Boutique 2024
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Chạm Vào <span className="text-primary">An Yên</span>
            <br />
            <span className="italic font-serif" style={{ color: '#ffb4a4' }}>Giữa Đại Ngàn Hùng Vĩ</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            className="text-base md:text-lg text-white/80 max-w-xl mx-auto mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            Hệ sinh thái nghỉ dưỡng sinh thái chữa lành & vận hành thông minh DigiStay tại Sa Pa, Tam Đảo & Đà Lạt.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            className="flex flex-wrap items-center justify-center gap-4 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <motion.a 
              href="#rooms" 
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold shadow-md"
              whileHover={{ scale: 1.05, boxShadow: '0 15px 30px rgba(169, 49, 25, 0.4)' }}
              whileTap={{ scale: 0.98 }}
            >
              Khám Phá Hạng Phòng
              <Icons.Arrow />
            </motion.a>
            
            <motion.button 
              onClick={() => setIsVideoModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/95 backdrop-blur-sm text-onSurface font-semibold shadow-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              ▶ Xem Video Thực Tế
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            className="flex flex-col items-center gap-2 text-white/60"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-xs font-medium">Cuộn xuống</span>
            <div className="w-5 h-8 rounded-full border border-white/40 flex justify-center pt-1">
              <motion.div
                className="w-1 h-1.5 rounded-full bg-white"
                animate={{ y: [0, 10, 0], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ================= QUICK BOOKING BAR ================= */}
      <motion.div 
        className="relative z-20 -mt-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-5 border border-outlineVariant/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
            {[
              { icon: Icons.Location, label: 'Điểm Đến', value: 'Bản Mường Hoa • Sa Pa' },
              { icon: Icons.Calendar, label: 'Thời Gian', value: '18/10 → 20/10/2026' },
              { icon: Icons.Users, label: 'Số Khách', value: '2 Người lớn, 1 Trẻ em' },
            ].map((item, index) => (
              <div
                key={index}
                className="p-3 rounded-lg hover:bg-surfaceLight transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold uppercase text-secondary flex items-center gap-1.5 mb-1">
                  <item.icon />
                  {item.label}
                </span>
                <div className="flex items-center justify-between font-medium text-onSurface text-sm">
                  <span>{item.value}</span>
                  {index < 2 && <span className="text-secondary"><Icons.Chevron /></span>}
                </div>
              </div>
            ))}

            {/* Search Button */}
            <button className="h-12 flex items-center justify-center gap-2 px-5 rounded-lg bg-primary text-white font-semibold shadow-sm hover:shadow-md transition-shadow">
              <span>Tìm Phòng Trống</span>
              <Icons.Arrow />
            </button>
          </div>

          {/* Trust Indicators */}
          <div className="mt-3 pt-3 flex flex-wrap items-center gap-4 text-xs text-secondary border-t border-outlineVariant/30">
            <span className="flex items-center gap-1"><span className="text-[#2a674c]"><Icons.Check /></span> Bảo đảm giá tốt nhất</span>
            <span className="flex items-center gap-1"><span className="text-[#2a674c]"><Icons.Lock /></span> Thanh toán bảo mật</span>
            <span className="flex items-center gap-1"><span className="text-[#2a674c]"><Icons.Check /></span> Hủy miễn phí 48h</span>
          </div>
        </div>
      </motion.div>

      {/* ================= PHILOSOPHY & PILLARS ================= */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-10">
          <div className="lg:col-span-7">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              // Triết Lý Khởi Sinh
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-onSurface tracking-tight mt-1">
              Nơi Hơi Thở Đại Ngàn Đánh Thức<br />
              <span className="italic font-serif" style={{ color: colors.tertiary }}>Năng Lượng Chữa Lành Tự Nhiên</span>
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-onSurfaceVariant text-sm leading-relaxed">
              Được xây dựng từ gỗ Pơ-mu bản địa tái sinh, đá suối thô ráp và tấm lợp tự nhiên, DigiStay chắt lọc những tinh hoa nguyên sơ nhất.
            </p>
          </div>
        </div>

        {/* Pillar Cards with Hover Effects */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {pillars.map((pillar, index) => (
            <motion.div
              key={index}
              className="p-6 rounded-xl bg-white shadow-sm border border-outlineVariant/20 group"
              variants={fadeInUp}
              whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
            >
              <motion.div 
                className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center transition-transform"
                style={{ backgroundColor: pillar.bgColor, color: pillar.iconColor }}
                whileHover={{ scale: 1.15, rotate: [0, -10, 10, 0] }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <pillar.icon />
              </motion.div>
              <span className="text-xs font-bold uppercase text-secondary block mb-1">{pillar.number} / {pillar.title}</span>
              <h3 className="font-bold text-onSurface mb-2">{pillar.subtitle}</h3>
              <p className="text-sm text-onSurfaceVariant leading-relaxed">{pillar.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ================= ROOM TYPES ================= */}
      <section id="rooms" className="mt-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <AnimatedSection className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              // Không Gian Nghỉ Dưỡng Thượng Tuyển
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-onSurface tracking-tight mt-1">
              Bộ Sưu Tập Hạng Phòng & Biệt Thự
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {['Tất cả (8)', 'Cặp đôi', 'Gia đình'].map((item, index) => (
              <motion.span
                key={item}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                  index === 0 ? 'bg-primary text-white' : 'bg-surface text-onSurfaceVariant hover:bg-surfaceHigh'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item}
              </motion.span>
            ))}
          </div>
        </AnimatedSection>

        {/* Room Cards with Zoom & Glow Effects */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {roomTypes.map((room) => (
            <motion.div
              key={room.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col group"
              variants={fadeInUp}
              whileHover={{ y: -10, boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
            >
              {/* Room Image with Zoom */}
              <div className="relative h-52 overflow-hidden">
                <motion.div
                  className="absolute inset-0"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  whileHover={{ scale: 1.1 }}
                >
                  <Image src={room.imageUrl} alt={room.name} fill className="object-cover" />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <motion.span 
                  className="absolute top-3 left-3 text-xs font-bold uppercase px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: room.badgeColor }}
                  whileHover={{ scale: 1.1, rotate: [-2, 2, 0] }}
                >
                  {room.badge}
                </motion.span>
                <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs flex items-center gap-1 backdrop-blur-sm">
                  <Icons.Camera />
                  <span>{room.images} Ảnh</span>
                </div>
              </div>

              {/* Room Details */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex flex-wrap gap-2 text-xs text-secondary uppercase mb-2">
                  <span className="flex items-center gap-1"><Icons.Area /> {room.size}m²</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Icons.Bed /> {room.bed}</span>
                </div>
                <h3 className="font-bold text-onSurface group-hover:text-primary transition-colors">{room.name}</h3>
                <p className="text-sm text-onSurfaceVariant mt-2 line-clamp-2 flex-1">{room.description}</p>

                {/* Price with Glow Animation */}
                <motion.div 
                  className="mt-4 pt-4 flex items-center justify-between border-t border-outlineVariant/30"
                >
                  <div>
                    <span className="text-xs text-secondary">Giá từ</span>
                    <motion.div 
                      className="flex items-baseline gap-1"
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <span className="text-lg font-bold text-primary">{room.price}</span>
                      <span className="text-xs text-secondary">/đêm</span>
                    </motion.div>
                  </div>
                  <MagneticButton>
                    <a 
                      href="#" 
                      className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow inline-flex items-center gap-1"
                    >
                      Giữ Phòng <Icons.Arrow />
                    </a>
                  </MagneticButton>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ================= EXPERIENCES ================= */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div 
          className="text-center max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            // Đánh Thức Mọi Giác Quan
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-onSurface tracking-tight mt-1">
            Trải Nghiệm Độc Bản Tại DigiStay
          </h2>
          <p className="text-onSurfaceVariant mt-2 text-sm">
            Mỗi khoảnh khắc được thiết kế như một nghi thức thanh lọc, đưa bạn kết nối sâu sắc với tự nhiên và văn hóa bản địa.
          </p>
        </motion.div>

        {/* Experience Grid with Parallax & Zoom */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {experiences.map((exp, index) => (
            <motion.div
              key={index}
              className="relative rounded-2xl overflow-hidden h-72 group cursor-pointer shadow-md"
              variants={fadeInUp}
              whileHover={{ scale: 1.03, y: -5 }}
            >
              {/* Image with Parallax Zoom */}
              <motion.div
                className="absolute inset-0"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 6, repeat: Infinity }}
                whileHover={{ scale: 1.15 }}
              >
                <Image src={exp.imageUrl} alt={exp.title} fill className="object-cover" />
              </motion.div>
              
              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
              
              {/* Border Glow on Hover */}
              <motion.div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ boxShadow: `inset 0 0 0 2px ${colors.primary}` }}
                animate={{ 
                  boxShadow: [
                    `inset 0 0 0 2px ${colors.primary}40`,
                    `inset 0 0 0 2px ${colors.primary}`,
                    `inset 0 0 0 2px ${colors.primary}40`
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              
              {/* Content */}
              <div className="absolute inset-0 p-5 flex flex-col justify-end text-white">
                <motion.span 
                  className="text-xs font-bold uppercase mb-1 w-fit px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: colors.primary }}
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: index * 0.3 }}
                >
                  {exp.number} • {exp.time}
                </motion.span>
                <h3 className="text-base font-bold mb-1">{exp.title}</h3>
                <p className="text-xs text-white/80 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {exp.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ================= AI CONCIERGE ================= */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div 
          className="bg-surfaceLight rounded-3xl p-6 sm:p-10 lg:p-14 relative overflow-hidden"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Background Glows */}
          <motion.div 
            className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full"
            style={{ backgroundColor: `${colors.primary}15` }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div 
            className="absolute -left-16 -top-16 w-64 h-64 rounded-full"
            style={{ backgroundColor: `${colors.tertiary}15` }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.7, 0.5] }}
            transition={{ duration: 5, repeat: Infinity }}
          />

          <div className="relative z-10">
            {/* Section Header */}
            <motion.div 
              className="text-center max-w-2xl mx-auto mb-10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <motion.div 
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm text-primary text-xs font-bold uppercase mb-3"
                whileHover={{ scale: 1.05 }}
              >
                <Icons.QrCode />
                Độc Quyền DigiStay
              </motion.div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-onSurface tracking-tight">
                Trợ Lý Cá Nhân{' '}
                <motion.span 
                  className="text-transparent bg-clip-text"
                  style={{ backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${colors.tertiary})` }}
                  animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  DigiStay AI
                </motion.span>
              </h2>
              <p className="text-onSurfaceVariant mt-2 text-sm sm:text-base">
                Sự kết hợp hoàn hảo giữa công nghệ số thông minh và lòng hiếu khách chân thành.
              </p>
            </motion.div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Left: Features */}
              <motion.div 
                className="space-y-4"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                {[
                  { icon: Icons.Calendar, title: 'Dự Báo Săn Mây Chuẩn Xác', desc: 'Cập nhật độ ẩm, hướng gió và tỉ lệ biển mây theo thời gian thực.' },
                  { icon: Icons.Support, title: 'Quản Gia 1-Kèm-1 Tận Tâm', desc: 'Đón tiếp tận xe, hỗ trợ hành lý và chuẩn bị bồn tắm thảo mộc.' },
                ].map((item, index) => (
                  <motion.div 
                    key={index}
                    className="flex items-start gap-4 p-4 rounded-xl bg-white shadow-sm"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ x: 5, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  >
                    <motion.span 
                      className="text-xl p-2 rounded-lg"
                      style={{ backgroundColor: `${colors.primary}15`, color: colors.primary }}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
                    >
                      <item.icon />
                    </motion.span>
                    <div>
                      <h4 className="font-bold text-onSurface">{item.title}</h4>
                      <p className="text-sm text-secondary mt-0.5">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}

                <MagneticButton>
                  <motion.button 
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-onSurface text-white font-semibold shadow-sm mt-4"
                    whileHover={{ scale: 1.02, backgroundColor: '#000' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icons.Support />
                    Trò Chuyện Với DigiStay AI
                  </motion.button>
                </MagneticButton>
              </motion.div>

              {/* Right: Chat Mockup with Floating Effect */}
              <motion.div 
                className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
              >
                {/* Chat Header */}
                <div className="flex items-center justify-between pb-3 border-b border-outlineVariant">
                  <div className="flex items-center gap-2">
                    <motion.div 
                      className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs"
                      animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 0 0 rgba(169,49,25,0.4)', '0 0 0 8px rgba(169,49,25,0)', '0 0 0 0 rgba(169,49,25,0)'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      AI
                    </motion.div>
                    <div>
                      <h4 className="font-bold text-onSurface text-sm">DigiStay Concierge AI</h4>
                      <span className="text-xs flex items-center gap-1" style={{ color: colors.tertiary }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                        Đang trực tuyến
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="py-3 space-y-3 text-sm">
                  <motion.div 
                    className="p-3 rounded-xl rounded-tl-sm bg-surfaceLight text-onSurface"
                    initial={{ x: -20, opacity: 0 }}
                    whileInView={{ x: 0, opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    ✨ Xin chào! Nhiệt độ Sa Pa sáng mai dự kiến 17°C, tỉ lệ có biển mây đạt 92%. Em đã chuẩn bị set trà ấm lúc 6:00 sáng nhé?
                  </motion.div>
                  <motion.div 
                    className="p-3 rounded-xl rounded-tr-sm bg-primary text-white ml-auto max-w-[85%]"
                    initial={{ x: 20, opacity: 0 }}
                    whileInView={{ x: 0, opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    Tuyệt vời! Chuẩn bị thêm bồn ngâm thuốc Dao Đỏ giúp mình lúc 17h chiều nhé.
                  </motion.div>
                  <motion.div 
                    className="p-3 rounded-xl rounded-tl-sm bg-surfaceLight text-onSurface flex items-center gap-2"
                    initial={{ x: -20, opacity: 0 }}
                    whileInView={{ x: 0, opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    <span style={{ color: colors.tertiary }}>✓</span>
                    <span>Dạ vâng, quản gia đã nhận yêu cầu và sẽ đúng 17:00 ạ!</span>
                  </motion.div>
                </div>

                {/* Chat Input with Glow */}
                <div className="flex items-center gap-2 p-2 rounded-xl bg-surfaceLight border-2 border-transparent focus-within:border-primary transition-colors">
                  <input className="bg-transparent flex-1 text-onSurface px-2 py-1.5 text-sm focus:outline-none" placeholder="Hỏi DigiStay AI..." />
                  <button className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:shadow-md transition-shadow">
                    <Icons.Arrow />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ================= REVIEWS ================= */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div 
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              // Cảm Nhận Từ Trái Tim
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-onSurface tracking-tight mt-1">
              Hồi Ức Đẹp Của Du Khách
            </h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-secondary">
            <span className="text-primary flex items-center">
              {[...Array(5)].map((_, i) => <Icons.Star key={i} />)}
            </span>
            <span className="font-bold text-onSurface">4.95 / 5.0</span>
            <span>•</span>
            <span>1,200+ đánh giá</span>
          </div>
        </motion.div>

        {/* Review Cards with Tilt Effect */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {reviews.map((review, index) => (
            <TiltCard key={index}>
              <motion.div
                className="bg-white p-6 rounded-2xl shadow-sm flex flex-col h-full"
                variants={fadeInUp}
                whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
              >
                <div>
                  {/* Stars with Animation */}
                  <motion.div 
                    className="flex items-center gap-1 text-primary mb-3"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 200, delay: index * 0.1 }}
                  >
                    {[...Array(review.rating)].map((_, i) => (
                      <motion.span 
                        key={i}
                        whileHover={{ scale: 1.3, rotate: 15 }}
                      >
                        <Icons.Star />
                      </motion.span>
                    ))}
                  </motion.div>
                  
                  {/* Quote Icon */}
                  <motion.div 
                    className="text-5xl font-serif mb-1"
                    style={{ color: `${colors.primary}15` }}
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, delay: index * 0.5 }}
                  >
                    "
                  </motion.div>
                  
                  <h4 className="text-base font-bold text-onSurface mb-2">"{review.title}"</h4>
                  <p className="text-sm text-onSurfaceVariant leading-relaxed">{review.content}</p>
                </div>
                
                {/* User Info */}
                <div className="mt-5 pt-4 flex items-center gap-3 border-t border-outlineVariant/30">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    <Image 
                      src={review.avatar} 
                      alt={review.name} 
                      width={44} 
                      height={44} 
                      className="rounded-full object-cover" 
                    />
                  </motion.div>
                  <div>
                    <h5 className="font-bold text-onSurface text-sm">{review.name}</h5>
                    <p className="text-xs text-secondary">{review.location}</p>
                  </div>
                </div>
              </motion.div>
            </TiltCard>
          ))}
        </motion.div>
      </section>

      {/* ================= NEWSLETTER ================= */}
      <section className="mt-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div 
          className="rounded-2xl overflow-hidden shadow-lg"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Background with Animated Orbs */}
          <div className="relative px-6 sm:px-10 py-12 sm:py-16" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})` }}>
            {/* Moving Orbs */}
            <motion.div 
              className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl"
              animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, 20, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
            />
            <motion.div 
              className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-white/10 blur-2xl"
              animate={{ scale: [1, 1.2, 1], x: [0, -20, 0], y: [0, -15, 0] }}
              transition={{ duration: 8, repeat: Infinity }}
            />
            
            {/* Animated Line Pattern */}
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full">
                <pattern id="lines" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="20" y2="20" stroke="white" strokeWidth="0.5" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#lines)" />
              </svg>
            </div>

            <div className="relative z-10 max-w-2xl mx-auto text-center">
              <motion.span 
                className="inline-flex items-center gap-2 text-sm font-bold uppercase px-4 py-1.5 rounded-full bg-white/20 text-white mb-4"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                🎁 Đặc Quyền Thành Viên
              </motion.span>
              
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Nhận Voucher Giảm{' '}
                <motion.span 
                  className="italic"
                  style={{ color: '#ffb4a4' }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  15%
                </motion.span>
              </h2>
              <p className="text-white/80 mt-2 text-sm sm:text-base">
                Đăng ký nhận bản tin để nhận mã ưu đãi độc quyền cho kỳ nghỉ đầu tiên.
              </p>

              {/* Form with Glow Input */}
              <form 
                className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mt-6"
                onSubmit={(e) => { e.preventDefault(); alert('Cảm ơn! Mã voucher đã được gửi đến email.') }}
              >
                <motion.input
                  type="email"
                  placeholder="Nhập email của bạn..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg text-onSurface placeholder:text-secondary focus:outline-none"
                  style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                  whileFocus={{ scale: 1.02, boxShadow: '0 4px 20px rgba(255,255,255,0.3)' }}
                  required
                />
                <MagneticButton>
                  <motion.button 
                    type="submit" 
                    className="px-6 py-3 rounded-lg bg-white text-primary font-semibold hover:bg-white/90 transition-colors shadow-md"
                    whileHover={{ scale: 1.05, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Nhận Mã
                  </motion.button>
                </MagneticButton>
              </form>
              <p className="text-white/60 text-xs mt-3">Cam kết bảo mật 100%. Không gửi spam.</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ================= TRUST BADGES ================= */}
      <section className="mt-12 mb-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div 
          className="rounded-xl p-6 relative overflow-hidden"
          style={{ backgroundColor: colors.surfaceLight }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Animated Border Gradient */}
          <motion.div 
            className="absolute inset-0 rounded-xl"
            style={{ 
              background: `linear-gradient(90deg, ${colors.primary}, ${colors.tertiary}, ${colors.primary})`,
              padding: '2px'
            }}
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            <div className="w-full h-full rounded-xl" style={{ backgroundColor: colors.surfaceLight }} />
          </motion.div>
            
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="font-bold text-onSurface">Cam Kết Chất Lượng & Bảo Chứng An Toàn</h4>
              <p className="text-sm text-secondary">Đặt phòng minh bạch qua hệ thống PMS DigiStay</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {[
                { icon: Icons.QrCode, label: 'VietQR', color: colors.primary },
                { icon: Icons.Verified, label: 'SSL 256-Bit', color: colors.tertiary },
                { icon: Icons.Terrace, label: 'Eco Certified', color: '#228b22' },
              ].map((item, index) => (
                <motion.div 
                  key={index}
                  className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm"
                  whileHover={{ y: -5, scale: 1.05, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${item.color}15`, color: item.color }}
                    animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }}
                  >
                    <item.icon />
                  </motion.div>
                  <span className="font-semibold text-onSurface text-sm">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-onSurface text-white mt-16">
        <motion.div 
          className="max-w-7xl mx-auto px-4 lg:px-8 py-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
            {/* Brand */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center">
                  <Icons.Spa />
                </div>
                <div>
                  <span className="block font-black text-lg tracking-tight uppercase">DIGISTAY</span>
                  <span className="block text-[9px] tracking-widest uppercase text-white/60">Smart Hospitality</span>
                </div>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Khu nghỉ dưỡng sinh thái cao cấp hòa mình trọn vẹn vào thiên nhiên hùng vĩ miền Tây Bắc.
              </p>
              <div className="space-y-1.5 text-xs text-white/80">
                <p className="flex items-center gap-2"><span style={{ color: '#ffb4a4' }}><Icons.Location /></span><strong>Cơ sở Sa Pa:</strong> Thung Lũng Mường Hoa</p>
                <p className="flex items-center gap-2"><span style={{ color: '#ffb4a4' }}><Icons.Location /></span><strong>Cơ sở Đà Lạt:</strong> Rừng Thông Khe Sanh</p>
                <p className="flex items-center gap-2"><span style={{ color: '#ffb4a4' }}><Icons.Phone /></span><strong>Hotline:</strong> 0988 123 456</p>
                <p className="flex items-center gap-2"><span style={{ color: '#ffb4a4' }}><Icons.Mail /></span><strong>Email:</strong> reservation@digistay.vn</p>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3">Về Retreat</h4>
              <ul className="space-y-2 text-xs text-white/70">
                <li><a href="#" className="hover:text-white transition-colors">Câu chuyện thương hiệu</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Phát triển bền vững</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kiến trúc & Cảnh quan</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tuyển dụng nhân sự</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3">Chính sách</h4>
              <ul className="space-y-2 text-xs text-white/70">
                <li><a href="#" className="hover:text-white transition-colors">Đặt phòng & Hủy hoàn</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Quy định nhận/trả phòng</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Chính sách bảo mật</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Câu hỏi thường gặp</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3">Thanh toán</h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-center">
                {['VietQR', 'Visa', 'MasterCard', 'ATM'].map((item) => (
                  <motion.div 
                    key={item}
                    className="bg-white/10 rounded-lg p-2 text-white cursor-pointer"
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.2)' }}
                  >
                    {item}
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-white/50">
                <Icons.Lock />
                Bảo mật SSL 256-Bit
              </div>
            </div>
          </div>

          {/* Bottom */}
          <motion.div 
            className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/50"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p>© 2026 DigiStay. Giấy phép kinh doanh số 0108999888.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-white">Điều khoản dịch vụ</a>
              <span>•</span>
              <a href="#" className="hover:text-white">Chính sách quyền riêng tư</a>
            </div>
          </motion.div>
        </motion.div>
      </footer>

      {/* Video Modal */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <motion.div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsVideoModalOpen(false)}
          >
            <motion.div 
              className="bg-white rounded-3xl max-w-3xl w-full p-6 relative shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.button 
                onClick={() => setIsVideoModalOpen(false)} 
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface hover:bg-surfaceHigh flex items-center justify-center transition-colors"
                whileHover={{ scale: 1.1, rotate: 90 }}
              >
                ✕
              </motion.button>
              <h3 className="text-lg font-bold mb-4">Thước Phim Toàn Cảnh DigiStay Retreat</h3>
              <motion.div 
                className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-200 flex items-center justify-center"
                whileHover={{ scale: 1.02 }}
              >
                <Image src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80" alt="Video" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <motion.div 
                    className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center shadow-lg cursor-pointer"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    ▶
                  </motion.div>
                </div>
              </motion.div>
              <p className="text-sm text-secondary mt-3 text-center">
                Trải nghiệm trực quan không gian mộc bản tại Bản Mường Hoa, Sa Pa.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
