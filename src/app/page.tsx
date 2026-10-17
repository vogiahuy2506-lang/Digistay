'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ═══════════════════════════════════════════════════════════
// 🎨 MODERN TRENDING ANIMATION EFFECTS SYSTEM
// ═══════════════════════════════════════════════════════════

// Animation Types
type AnimationType = 
  | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' 
  | 'zoom-in' | 'zoom-out' | 'blur-in' | 'slide-up' 
  | 'bounce-in' | 'flip-in' | 'rotate-in' | 'scale-in'
  | 'parallax' | 'split-reveal' | 'curtain-reveal'

// Material Symbols icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`}>{name}</span>
  )
}

// ═══════════════════════════════════════════════════════════
// ✨ 1. ENHANCED SCROLL REVEAL WITH SPRING PHYSICS
// ═══════════════════════════════════════════════════════════
function useSpringReveal(options: {
  threshold?: number
  rootMargin?: string
  animation?: AnimationType
  delay?: number
  duration?: number
  springConfig?: { stiffness: number; damping: number }
}) {
  const { 
    threshold = 0.15, 
    rootMargin = '-30px', 
    animation = 'fade-up', 
    delay = 0, 
    duration = 800,
    springConfig = { stiffness: 100, damping: 15 }
  } = options
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold, rootMargin }
    )

    const element = ref.current
    if (element) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [threshold, rootMargin])

  // Parallax scroll effect
  useEffect(() => {
    if (animation !== 'parallax') return
    
    const handleScroll = () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const scrollCenter = window.innerHeight / 2
      const elementCenter = rect.top + rect.height / 2
      const progress = (scrollCenter - elementCenter) / (window.innerHeight / 2)
      setScrollProgress(Math.max(-1, Math.min(1, progress)))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [animation])

  const getAnimationStyle = () => {
    const baseStyles: Record<string, React.CSSProperties> = {
      'fade-up': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'translateY(0)' : 'translateY(60px)' 
      },
      'fade-down': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'translateY(0)' : 'translateY(-60px)' 
      },
      'fade-left': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'translateX(0)' : 'translateX(-60px)' 
      },
      'fade-right': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'translateX(0)' : 'translateX(60px)' 
      },
      'zoom-in': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'scale(1)' : 'scale(0.7)' 
      },
      'zoom-out': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'scale(1)' : 'scale(1.3)' 
      },
      'blur-in': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'blur(0)' : 'blur(20px)' 
      },
      'slide-up': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'translateY(0) skewY(0deg)' : 'translateY(100px) skewY(3deg)' 
      },
      'bounce-in': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.5) translateY(80px)' 
      },
      'flip-in': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'rotateX(0) scale(1)' : 'rotateX(90deg) scale(0.8)' 
      },
      'rotate-in': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'rotate(0deg) scale(1)' : 'rotate(-180deg) scale(0.5)' 
      },
      'scale-in': { 
        opacity: isVisible ? 1 : 0, 
        transform: isVisible ? 'scale(1)' : 'scale(0)' 
      },
      'parallax': {
        transform: `translateY(${scrollProgress * 50}px)`
      },
      'split-reveal': { 
        opacity: isVisible ? 1 : 0, 
        clipPath: isVisible ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' 
      },
      'curtain-reveal': { 
        opacity: isVisible ? 1 : 0, 
        clipPath: isVisible ? 'inset(0 0 0 0)' : 'inset(50% 0 50% 0)' 
      },
    }

    const easing = `cubic-bezier(${springConfig.stiffness / 200}, ${springConfig.damping / 20}, 0.68, 0.53)`
    return {
      ...baseStyles[animation],
      transition: `all ${duration}ms ${easing} ${delay}ms`,
      willChange: 'transform, opacity',
    }
  }

  return { ref, style: getAnimationStyle(), isVisible }
}

// ═══════════════════════════════════════════════════════════
// 🎯 2. ANIMATED SECTION WRAPPER
// ═══════════════════════════════════════════════════════════
function AnimatedSection({ 
  children, 
  className = '', 
  animation = 'fade-up',
  delay = 0,
  duration = 800,
  springConfig,
  stagger = false,
  threshold,
}: { 
  children: React.ReactNode
  className?: string
  animation?: AnimationType
  delay?: number
  duration?: number
  springConfig?: { stiffness: number; damping: number }
  stagger?: boolean
  threshold?: number
}) {
  const { ref, style, isVisible } = useSpringReveal({ 
    animation, 
    delay, 
    duration, 
    springConfig,
    threshold 
  })
  
  return (
    <div 
      ref={ref} 
      className={`${className} ${isVisible ? 'animate-active' : ''}`} 
      style={style}
    >
      {children}
    </div>
  )
}

// Alias for backwards compatibility
const Section = AnimatedSection

// ═══════════════════════════════════════════════════════════
// 🎪 3. STAGGERED CHILDREN WITH DYNAMIC DELAYS
// ═══════════════════════════════════════════════════════════
function StaggeredChildren({ 
  children, 
  className = '', 
  staggerDelay = 80,
  animation = 'fade-up',
  direction = 'up' // 'up', 'down', 'left', 'right'
}: { 
  children: React.ReactNode
  className?: string
  staggerDelay?: number
  animation?: AnimationType
  direction?: 'up' | 'down' | 'left' | 'right'
}) {
  const animations: Record<string, AnimationType> = {
    up: 'fade-up',
    down: 'fade-down',
    left: 'fade-left',
    right: 'fade-right',
  }
  
  return (
    <div className={className}>
      {Array.isArray(children) 
        ? children.map((child, index) => (
            <AnimatedSection 
              key={index} 
              animation={animations[direction]}
              delay={index * staggerDelay}
              duration={600}
            >
              {child}
            </AnimatedSection>
          ))
        : children
      }
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🧲 4. MAGNETIC BUTTON WITH SMOOTH FOLLOW
// ═══════════════════════════════════════════════════════════
function MagneticButton({ 
  children, 
  className = '',
  strength = 0.4,
  glowColor = 'rgba(169, 49, 25, 0.3)'
}: { 
  children: React.ReactNode
  className?: string
  strength?: number
  glowColor?: string
}) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    
    buttonRef.current.style.transform = `translate(${x * strength}px, ${y * strength}px)`
    buttonRef.current.style.boxShadow = isHovered ? `0 20px 40px ${glowColor}` : ''
  }, [strength, isHovered, glowColor])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    if (!buttonRef.current) return
    buttonRef.current.style.transform = 'translate(0, 0)'
    buttonRef.current.style.boxShadow = ''
  }, [])

  return (
    <div 
      ref={buttonRef}
      className={`transition-all duration-200 ease-out ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ willChange: 'transform, box-shadow' }}
    >
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎴 5. 3D TILT CARD WITH REFLECTION
// ═══════════════════════════════════════════════════════════
function TiltCard3D({ 
  children, 
  className = '',
  tiltStrength = 15,
  glareStrength = 0.3
}: { 
  children: React.ReactNode
  className?: string
  tiltStrength?: number
  glareStrength?: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('')
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 })

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const rotateX = (y - centerY) / centerY * tiltStrength
    const rotateY = (centerX - x) / centerX * tiltStrength
    
    setTransform(
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
    )
    
    // Update glare position
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100
    })
  }, [tiltStrength])

  const handleMouseLeave = useCallback(() => {
    setTransform('perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)')
    setGlarePos({ x: 50, y: 50 })
  }, [])

  return (
    <div 
      ref={cardRef}
      className={`relative overflow-hidden transition-transform duration-200 ease-out ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        transform,
        transformStyle: 'preserve-3d',
        willChange: 'transform'
      }}
    >
      {/* Glare overlay */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ 
          opacity: transform ? 1 : 0,
          background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glareStrength}) 0%, transparent 50%)`,
        }}
      />
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ✍️ 6. TEXT SCRAMBLE EFFECT (TRENDING)
// ═══════════════════════════════════════════════════════════
function TextScramble({ 
  children, 
  className = '',
  scrambleChars = '!<>-_\\/[]{}—=+*^?#________',
  speed = 30
}: { 
  children: string
  className?: string
  scrambleChars?: string
  speed?: number
}) {
  const [displayText, setDisplayText] = useState(children)
  const [isScrambling, setIsScrambling] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isScrambling) {
          setIsScrambling(true)
          let iteration = 0
          const originalText = children
          
          timeoutRef.current = setInterval(() => {
            setDisplayText(
              originalText.split('').map((letter, index) => {
                if (index < iteration) {
                  return originalText[index]
                }
                return scrambleChars[Math.floor(Math.random() * scrambleChars.length)]
              }).join('')
            )
            
            if (iteration >= originalText.length) {
              clearInterval(timeoutRef.current)
              setDisplayText(originalText)
            }
            
            iteration += 0.5
          }, speed)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      observer.disconnect()
      if (timeoutRef.current) clearInterval(timeoutRef.current)
    }
  }, [children, scrambleChars, speed, isScrambling])

  return <span ref={ref} className={className}>{displayText}</span>
}

// ═══════════════════════════════════════════════════════════
// 🎬 7. TYPEWRITER EFFECT (VERY TRENDING)
// ═══════════════════════════════════════════════════════════
function Typewriter({ 
  children, 
  className = '',
  speed = 50,
  startDelay = 500
}: { 
  children: string
  className?: string
  speed?: number
  startDelay?: number
}) {
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isTyping) {
          setIsTyping(true)
          let index = 0
          
          setTimeout(() => {
            const interval = setInterval(() => {
              setDisplayText(children.slice(0, index + 1))
              index++
              if (index >= children.length) {
                clearInterval(interval)
              }
            }, speed)
            
            return () => clearInterval(interval)
          }, startDelay)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [children, speed, startDelay, isTyping])

  return (
    <span ref={ref} className={className}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  )
}

// ═══════════════════════════════════════════════════════════
// 🔢 8. COUNTER ANIMATION WITH SPRING
// ═══════════════════════════════════════════════════════════
function AnimatedCounter({ 
  end, 
  duration = 2500,
  prefix = '',
  suffix = '',
  decimals = 0
}: { 
  end: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          let startTime: number
          const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            
            // Spring easing
            const eased = 1 - Math.pow(1 - progress, 4)
            setCount(eased * end)
            
            if (progress < 1) {
              requestAnimationFrame(animate)
            } else {
              setCount(end)
            }
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [end, duration, hasAnimated])

  return (
    <span ref={ref}>
      {prefix}{count.toFixed(decimals)}{suffix}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎇 9. RIPPLE EFFECT BUTTON (TRENDING)
// ═══════════════════════════════════════════════════════════
function RippleButton({ 
  children, 
  className = '',
  onClick,
  color = 'rgba(255, 255, 255, 0.4)'
}: { 
  children: React.ReactNode
  className?: string
  onClick?: () => void
  color?: string
}) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now()
    
    setRipples(prev => [...prev, { x, y, id }])
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id))
    }, 700)
    
    onClick?.()
  }

  return (
    <button 
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
    >
      {ripples.map(ripple => (
        <span 
          key={ripple.id}
          className="absolute rounded-full animate-ripple-expand"
          style={{ 
            left: ripple.x, 
            top: ripple.y, 
            transform: 'translate(-50%, -50%)',
            background: color,
            width: '10px',
            height: '10px',
          }}
        />
      ))}
      {children}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// 🖱️ 10. CURSOR FOLLOWER WITH GLOW
// ═══════════════════════════════════════════════════════════
function CursorFollower() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isClicking, setIsClicking] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
    }

    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a, button, [role="button"], input, select, textarea')) {
        setIsHovering(true)
      } else {
        setIsHovering(false)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mouseover', handleMouseOver)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mouseover', handleMouseOver)
    }
  }, [])

  return (
    <div 
      className={`fixed pointer-events-none z-[9999] transition-all duration-150 ${isClicking ? 'scale-50' : ''}`}
      style={{ 
        left: position.x, 
        top: position.y, 
        transform: 'translate(-50%, -50%)' 
      }}
    >
      {/* Outer glow ring */}
      <div 
        className={`absolute rounded-full transition-all duration-300 ${isHovering ? 'w-16 h-16 opacity-100' : 'w-10 h-10 opacity-50'}`}
        style={{ 
          background: 'radial-gradient(circle, rgba(169, 49, 25, 0.3) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          left: '50%',
          top: '50%'
        }}
      />
      {/* Inner dot */}
      <div 
        className={`w-3 h-3 rounded-full border-2 border-primary transition-all duration-200 ${isHovering ? 'bg-primary scale-150' : 'bg-transparent'}`}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🌊 11. FLOATING PARTICLES BACKGROUND
// ═══════════════════════════════════════════════════════════
function FloatingParticles({ count = 30, color = '169, 49, 25' }: { count?: number; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      opacity: number
      angle: number
      angleSpeed: number
    }> = []

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 4 + 2,
        speedX: (Math.random() - 0.5) * 0.6,
        speedY: (Math.random() - 0.5) * 0.6,
        opacity: Math.random() * 0.4 + 0.1,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: (Math.random() - 0.5) * 0.02
      })
    }

    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      particles.forEach(particle => {
        particle.x += particle.speedX
        particle.y += particle.speedY
        particle.angle += particle.angleSpeed

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1

        // Draw glow
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2)
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        )
        gradient.addColorStop(0, `rgba(${color}, ${particle.opacity})`)
        gradient.addColorStop(1, `rgba(${color}, 0)`)
        ctx.fillStyle = gradient
        ctx.fill()

        // Draw core
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${color}, ${particle.opacity + 0.2})`
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [count, color])

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}

// ═══════════════════════════════════════════════════════════
// 🌈 12. MORPHING GRADIENT ANIMATION
// ═══════════════════════════════════════════════════════════
function MorphingGradient() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Primary gradient blob */}
      <div className="absolute top-1/4 -left-1/4 w-[900px] h-[900px] rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl animate-morph-1" />
      
      {/* Secondary gradient blob */}
      <div className="absolute bottom-1/4 -right-1/4 w-[700px] h-[700px] rounded-full bg-gradient-to-tl from-tertiary/15 via-tertiary/5 to-transparent blur-3xl animate-morph-2" />
      
      {/* Tertiary gradient blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full bg-gradient-to-r from-secondary/10 via-transparent to-primary/10 blur-3xl animate-morph-3" />
      
      {/* Animated mesh gradient overlay */}
      <div 
        className="absolute inset-0 opacity-30 animate-gradient-shift"
        style={{
          background: 'linear-gradient(45deg, transparent 30%, rgba(169, 49, 25, 0.05) 50%, transparent 70%)'
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎭 13. SMOOTH PARALLAX SCROLL WITH ZOOM (BOTH DIRECTIONS)
// ═══════════════════════════════════════════════════════════
function useParallaxZoom(options: {
  speed?: number
  zoomSpeed?: number
  zoomRange?: number
}) {
  const { speed = 0.1, zoomSpeed = 0.6, zoomRange = 1.12 } = options
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ y: 0, scale: 1 })
  const prevProgress = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return
      
      const rect = ref.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      
      // Calculate progress: 0 when element is at bottom, 1 when at top
      const progress = 1 - (rect.top / viewportHeight)
      const clampedProgress = Math.max(0, Math.min(1, progress))
      
      // Smooth transition between states
      const smoothedProgress = prevProgress.current + (clampedProgress - prevProgress.current) * 0.1
      prevProgress.current = smoothedProgress
      
      // Parallax Y - subtle movement
      const yOffset = (smoothedProgress - 0.5) * 80
      
      // Zoom - more pronounced at center of viewport
      const distFromCenter = 1 - Math.abs(smoothedProgress - 0.5) * 2
      const scale = 1 + (distFromCenter * zoomSpeed * 0.5)
      
      setTransform({ y: yOffset, scale: Math.min(zoomRange, scale) })
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed, zoomSpeed, zoomRange])

  return { 
    ref, 
    style: { 
      transform: `translateY(${transform.y}px) scale(${transform.scale})`,
      willChange: 'transform'
    } 
  }
}

// Parallax Section with Zoom
function ParallaxZoomSection({ 
  children, 
  className = '',
  speed = 0.1,
  zoomSpeed = 0.6,
  zoomRange = 1.12
}: { 
  children: React.ReactNode
  className?: string
  speed?: number
  zoomSpeed?: number
  zoomRange?: number
}) {
  const { ref, style } = useParallaxZoom({ speed, zoomSpeed, zoomRange })
  
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🌟 14. SCROLL ZOOM IMAGE EFFECT (For hero backgrounds)
// ═══════════════════════════════════════════════════════════
function ScrollZoomImage({ 
  children, 
  className = '',
  zoomFactor = 1.3
}: { 
  children: React.ReactNode
  className?: string
  zoomFactor?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const scrollProgress = Math.max(0, Math.min(1, -rect.top / (window.innerHeight * 0.5)))
      const newScale = 1 + (zoomFactor - 1) * (1 - scrollProgress)
      setScale(Math.max(1, newScale))
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [zoomFactor])

  return (
    <div ref={ref} className={className} style={{ 
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
      willChange: 'transform'
    }}>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ✨ 14. GLOW HOVER EFFECT
// ═══════════════════════════════════════════════════════════
function GlowCard({ 
  children, 
  className = '',
  glowColor = '169, 49, 25'
}: { 
  children: React.ReactNode
  className?: string
  glowColor?: string
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div 
      className={`relative transition-all duration-500 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect behind card */}
      <div 
        className={`absolute inset-0 rounded-3xl blur-xl transition-opacity duration-500 ${isHovered ? 'opacity-50' : 'opacity-0'}`}
        style={{
          background: `radial-gradient(ellipse at center, rgba(${glowColor}, 0.3) 0%, transparent 70%)`
        }}
      />
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎪 15. MARQUEE INFINITE SCROLL
// ═══════════════════════════════════════════════════════════
function Marquee({ 
  children, 
  speed = 30,
  direction = 'left' // 'left' or 'right'
}: { 
  children: React.ReactNode
  speed?: number
  direction?: 'left' | 'right'
}) {
  return (
    <div className="overflow-hidden relative">
      <div 
        className="flex gap-8 animate-marquee"
        style={{
          animation: `marquee ${speed}s linear infinite`,
          animationDirection: direction === 'right' ? 'reverse' : 'normal'
        }}
      >
        {children}
        {children}
      </div>
    </div>
  )
}

// Smooth Scroll to Section
function useSmoothScroll() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return scrollToSection
}

// Mouse Follower
function MouseFollower() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
    }

    const handleMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a, button, [role="button"]')) {
        setIsHovering(true)
      } else {
        setIsHovering(false)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseover', handleMouseOver)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseover', handleMouseOver)
    }
  }, [])

  return (
    <div 
      className={`fixed pointer-events-none z-[9999] transition-all duration-300 ${isHovering ? 'scale-150 opacity-50' : 'scale-100 opacity-30'}`}
      style={{ 
        left: position.x, 
        top: position.y, 
        transform: 'translate(-50%, -50%)' 
      }}
    >
      <div className="w-8 h-8 rounded-full border-2 border-primary animate-pulse" />
    </div>
  )
}

// Template Card Component
function TemplateCard({ 
  name, 
  description, 
  category, 
  tags, 
  isPopular = false,
  image 
}: { 
  name: string; 
  description: string; 
  category: string; 
  tags: string[]; 
  isPopular?: boolean;
  image: string;
}) {
  return (
    <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between">
      <div>
        <div className="relative h-64 overflow-hidden bg-surface-container">
          <img 
            alt={name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            src={image}
          />
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface font-label-caps text-label-caps uppercase font-bold">
            {category}
          </div>
          {isPopular && (
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold">
              Phổ Biến Nhất
            </div>
          )}
          {!isPopular && (
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold">
              Conversion +34%
            </div>
          )}
        </div>
        <div className="p-space-md">
          <h4 className="font-headline-sm text-on-surface font-bold">{name}</h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">
            {description}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.map((tag, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-label-caps text-on-surface-variant">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="p-space-md pt-0">
        <a 
          href="#dang-ky-dung-thu" 
          className={`w-full py-2.5 rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 transition-all ${
            isPopular
              ? 'bg-primary text-on-primary hover:bg-primary-container shadow-md'
              : 'bg-surface-container text-on-surface hover:bg-primary hover:text-white'
          }`}
        >
          <Icon name="visibility" className="text-base" />
          <span>Xem Mẫu Thử & Áp Dụng</span>
        </a>
      </div>
    </div>
  )
}

// Pricing Card Component
function PricingCard({ 
  name, 
  price, 
  period, 
  description, 
  features, 
  isPopular = false, 
  badge 
}: { 
  name: string; 
  price: string; 
  period: string; 
  description: string; 
  features: string[]; 
  isPopular?: boolean; 
  badge?: string;
}) {
  return (
    <div className={`rounded-3xl p-space-lg flex flex-col justify-between ${
      isPopular 
        ? 'bg-surface-container-lowest border-2 border-primary shadow-2xl relative' 
        : 'bg-surface-container-lowest border border-outline-variant/30 shadow-sm'
    }`}>
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-on-primary font-label-caps text-label-caps uppercase tracking-wider font-bold shadow-md">
          {badge}
        </div>
      )}
      <div>
        <div className={`flex justify-between items-center ${isPopular ? 'mt-2' : ''}`}>
          <h3 className="font-headline-sm text-on-surface font-bold">{name}</h3>
          {!isPopular && badge && (
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest font-label-caps text-label-caps text-on-surface-variant uppercase">{badge}</span>
          )}
          {isPopular && (
            <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-label-caps text-label-caps uppercase font-bold">Khuyên Dùng</span>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">{description}</p>
        <div className="mt-space-md">
          <span className={`font-headline-xl font-bold ${isPopular ? 'text-primary' : 'text-on-surface'}`}>{price}</span>
          <span className="font-body-md text-body-md text-on-surface-variant">{period}</span>
        </div>
        <ul className="mt-space-md space-y-2.5 font-body-sm text-body-sm text-on-surface">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2">
              <Icon name="check" className="text-lg text-tertiary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <a 
        href="#dang-ky-dung-thu" 
        className={`mt-space-lg w-full py-3.5 rounded-xl font-label-lg text-label-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 ${
          isPopular
            ? 'bg-primary text-on-primary hover:bg-primary-container shadow-lg'
            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
        }`}
      >
        {isPopular ? 'Trải Nghiệm Gói Pro Miễn Phí' : badge === 'Homestay Nhỏ' ? 'Dùng Thử 14 Ngày' : 'Liên Hệ Đội Ngũ Kỹ Thuật'}
      </a>
    </div>
  )
}

// ROI Calculator Component
function ROICalculator() {
  const [rooms, setRooms] = useState(12)
  const [adr, setAdr] = useState(1200000)
  const [directRatio, setDirectRatio] = useState(35)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ'
  }

  const monthlyRoomNights = rooms * 30 * 0.7
  const directRoomNights = monthlyRoomNights * (directRatio / 100)
  const directRevenue = directRoomNights * adr
  const savedCommissionMonthly = directRevenue * 0.18
  const savedCommissionYearly = savedCommissionMonthly * 12

  return (
    <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-space-lg sm:margin shadow-xl">
      <div className="text-center max-w-2xl mx-auto mb-space-lg">
        <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold">Bảng Tính Tiết Kiệm Chi Phí Trực Quan</span>
        <h2 className="mt-space-xs font-headline-lg text-headline-lg-mobile md:font-headline-lg text-on-surface tracking-tight">
          Ước Tính Số Tiền Bạn Giữ Lại Mỗi Năm
        </h2>
        <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
          Kéo thanh trượt để xem ngay số tiền hoa hồng OTA được giữ trọn vẹn tại quỹ của khách sạn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center">
        {/* Left Controls */}
        <div className="lg:col-span-7 space-y-space-md text-left">
          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high">
            <div className="flex justify-between items-center mb-2">
              <label className="font-label-lg text-label-lg text-on-surface font-bold">Quy mô cơ sở (Số phòng):</label>
              <span className="font-headline-sm text-primary font-bold">{rooms} Phòng</span>
            </div>
            <input
              type="range"
              min="3"
              max="60"
              step="1"
              value={rooms}
              onChange={(e) => setRooms(parseInt(e.target.value))}
              className="w-full accent-primary h-2 bg-surface-container rounded-lg cursor-pointer"
            />
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high">
            <div className="flex justify-between items-center mb-2">
              <label className="font-label-lg text-label-lg text-on-surface font-bold">Giá bán trung bình / đêm (VND):</label>
              <span className="font-headline-sm text-on-surface font-bold">{formatCurrency(adr)}</span>
            </div>
            <input
              type="range"
              min="400000"
              max="5000000"
              step="100000"
              value={adr}
              onChange={(e) => setAdr(parseInt(e.target.value))}
              className="w-full accent-primary h-2 bg-surface-container rounded-lg cursor-pointer"
            />
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high">
            <div className="flex justify-between items-center mb-2">
              <label className="font-label-lg text-label-lg text-on-surface font-bold">Tỷ lệ khách Direct Booking mục tiêu:</label>
              <span className="font-headline-sm text-tertiary font-bold">{directRatio}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="80"
              step="5"
              value={directRatio}
              onChange={(e) => setDirectRatio(parseInt(e.target.value))}
              className="w-full accent-primary h-2 bg-surface-container rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Right: Dashboard Savings Metric Output */}
        <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-surface-container-high to-surface-container p-space-lg text-center shadow-md border border-outline-variant/30 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-caps text-label-caps uppercase font-bold">
              <Icon name="trending_up" className="text-base" /> Lợi Nhuận Thuần Giữ Lại
            </div>
            <div className="mt-4 font-display-hero text-headline-xl-mobile sm:text-headline-xl text-tertiary font-bold tracking-tight">
              +{formatCurrency(savedCommissionYearly)}
            </div>
            <span className="font-label-md text-label-md text-on-surface-variant block mt-1">Ước tính mỗi năm không còn mất phí sàn OTA</span>
            <div className="mt-4 pt-4 border-t border-surface-container-highest flex items-center justify-between text-left">
              <div>
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Mỗi tháng tiết kiệm</span>
                <span className="font-headline-sm text-primary font-bold">{formatCurrency(savedCommissionMonthly)}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="account_balance_wallet" className="text-2xl" />
              </div>
            </div>
          </div>
          <a href="#dang-ky-dung-thu" className="mt-6 w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-lg shadow-primary/20 hover:bg-primary-container transition-all">
            <Icon name="redeem" className="text-lg" />
            <span>Giữ Lại Doanh Thu Ngay Hôm Nay</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [formData, setFormData] = useState({
    hotelName: '',
    phone: '',
    scale: '5-20'
  })

  const router = useRouter()
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Encode form data to pass to register page
    const params = new URLSearchParams({
      hotelName: formData.hotelName,
      phone: formData.phone,
      scale: formData.scale,
      createWorkspace: 'true'
    })
    router.push(`/register?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased selection:bg-primary-fixed selection:text-primary">
      {/* Floating Particles Background */}
      <FloatingParticles count={40} color="169, 49, 25" />
      
      {/* Morphing Gradient Background */}
      <MorphingGradient />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-surface-container">
    <div className="h-20 max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4 md:gap-6">
      <div className="flex items-center gap-4 md:gap-6">
        <a href="#" className="flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <Icon name="villa" className="text-2xl" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-sm text-on-surface font-bold">DigiStay</span>
              <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-caps text-label-caps uppercase">SaaS</span>
            </div>
            <span className="font-label-caps text-label-caps tracking-widest text-on-surface-variant uppercase hidden sm:block">Boutique OS</span>
          </div>
        </a>
        <nav className="hidden xl:flex items-center gap-8">
          <a href="#tinh-nang" className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-2 whitespace-nowrap">Tính Năng</a>
          <a href="#mau-giao-dien" className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-2 whitespace-nowrap">Mẫu Giao Diện</a>
          <a href="#so-sanh" className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-2 whitespace-nowrap">So Sánh OTA</a>
          <a href="#tinh-roi" className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-2 whitespace-nowrap">Tính Tiết Kiệm</a>
          <a href="#bang-gia" className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-2 whitespace-nowrap">Bảng Giá</a>
        </nav>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <a href="/login">
          <MagneticButton className="cursor-pointer" strength={0.15} glowColor="rgba(169, 49, 25, 0.2)">
            <span className="hidden sm:inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-all duration-300 hover:scale-105">
              Đăng Nhập
            </span>
          </MagneticButton>
        </a>
        <MagneticButton strength={0.2} glowColor="rgba(169, 49, 25, 0.4)">
          <RippleButton className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container transition-all duration-300 shadow-[0_4px_16px_-4px_rgba(169,49,25,0.4)] hover:scale-105 hover:shadow-[0_8px_32px_-4px_rgba(169,49,25,0.5)]">
            <span>Trải Nghiệm Miễn Phí 14 Ngày</span>
            <Icon name="arrow_forward" className="text-lg ml-1 group-hover:translate-x-1 transition-transform" />
          </RippleButton>
        </MagneticButton>
        <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center font-bold text-xs hover:scale-110 transition-transform cursor-pointer">VN</div>
      </div>
    </div>
  </header>

      <main className="w-full pt-20 bg-surface">
        <div className="flex flex-col w-full">
          {/* SECTION 1: HERO DISPLAY */}
          <ParallaxZoomSection speed={0.1} zoomSpeed={0.6} zoomRange={1.12} className="relative overflow-hidden py-10 md:py-16 lg:py-20">
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[850px] h-[420px] bg-primary/8 rounded-full blur-3xl pointer-events-none -z-10"></div>
            <div className="absolute -top-24 right-10 w-96 h-96 bg-tertiary/5 rounded-full blur-2xl pointer-events-none -z-10"></div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center text-center">
              {/* Tagline Badge */}
              <AnimatedSection animation="bounce-in" duration={800} className="mt-4 md:mt-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-high border border-outline-variant/30 text-on-surface shadow-lg animate-glow-pulse hover:scale-105 transition-transform">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse"></span>
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface font-bold">Nền Tảng No-Code Xây Dựng Kênh Bán Phòng Độc Quyền</span>
                  <span className="text-outline-variant font-label-caps">|</span>
                  <span className="inline-flex items-center gap-1 font-label-caps text-label-caps text-primary font-bold">
                    <Icon name="verified" className="text-base animate-bounce-subtle" /> 0% Phí Sàn
                  </span>
                </div>
              </AnimatedSection>

              {/* Main SaaS Headline */}
              <AnimatedSection animation="fade-up" delay={100} duration={900} className="mt-4 md:mt-6">
                <h1 className="font-display-hero text-headline-xl-mobile md:text-display-hero text-on-surface max-w-5xl tracking-tight leading-tight">
                  Tự Thiết Kế Website Đặt Phòng Riêng Biệt. <br className="hidden sm:inline"/>
                  <span className="text-primary animate-text-shimmer">Giải Phóng Lợi Nhuận</span> Khỏi Phí Hoa Hồng OTA 15–20%.
                </h1>
              </AnimatedSection>

              <AnimatedSection animation="fade-up" delay={200} duration={900} className="mt-4 md:mt-6">
                <p className="font-body-lg text-body-md md:text-body-lg text-on-surface-variant max-w-3xl leading-relaxed">
                  DigiStay là nền tảng SaaS No-Code toàn diện: Tự tạo website boutique hotel chỉ trong 15 phút, tích hợp Booking Engine trực tiếp, đồng bộ phòng tức thì và cổng VietQR Napas247 tiền về ngay trong 3 giây.
                </p>
              </AnimatedSection>

              {/* CTAs */}
              <AnimatedSection animation="fade-up" delay={300} duration={800} className="mt-6 md:mt-8 flex flex-col sm:flex-row items-center gap-4 md:gap-6">
                <MagneticButton strength={0.25} glowColor="rgba(169, 49, 25, 0.5)">
                  <RippleButton 
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-xl shadow-primary/30 hover:bg-primary-container transition-all duration-300 scale-100 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/40"
                    onClick={() => document.getElementById('dang-ky-dung-thu')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Icon name="bolt" className="text-xl animate-pulse-subtle" />
                    Bắt Đầu Dùng Thử Miễn Phí (14 Ngày)
                  </RippleButton>
                </MagneticButton>
                <MagneticButton strength={0.2}>
                  <RippleButton 
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-label-lg text-label-lg shadow-sm hover:bg-surface-container-high transition-all duration-300 hover:scale-[1.02] hover:border-primary/50"
                    onClick={() => document.getElementById('mau-giao-dien')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Icon name="visibility" className="text-xl text-primary" />
                    Khám Phá Mẫu Giao Diện Mẫu
                  </RippleButton>
                </MagneticButton>
              </AnimatedSection>

              {/* Visual Showcase with Floating Badges & Studio Window */}
              <Section className="mt-8 md:mt-10 w-full max-w-6xl relative">
                {/* Floating Chip 1: Profit Saved - Moved outside and above */}
                <div className="hidden lg:flex items-center gap-3 absolute -left-4 top-0 z-20 px-4 py-3 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md shadow-xl border border-surface-container-high">
                  <div className="w-10 h-10 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center justify-center">
                    <Icon name="savings" className="text-2xl" />
                  </div>
                  <div className="text-left">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Lợi Nhuận Giữ Lại</span>
                    <span className="font-title-md text-title-md font-bold text-tertiary">+228.614.400 đ/năm</span>
                  </div>
                </div>

                {/* Floating Chip 2: VietQR - Moved to right side, above studio */}
                <div className="hidden lg:flex items-center gap-3 absolute -right-4 top-0 z-20 px-4 py-3 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md shadow-xl border border-surface-container-high">
                  <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                    <Icon name="qr_code_scanner" className="text-2xl" />
                  </div>
                  <div className="text-left">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">VietQR Napas247</span>
                    <span className="font-title-md text-title-md font-bold text-primary">Khớp cọc trong 3 giây</span>
                  </div>
                </div>

                {/* Studio Window Container - Added marginTop to clear floating badges on lg+ */}
                <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xl p-2 md:p-4 text-left mt-0 lg:mt-20">
                  {/* Mock Browser Chrome Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4 pb-2 md:pb-4 px-2 md:px-4 border-b border-surface-container text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-error/80"></span>
                      <span className="w-3 h-3 rounded-full bg-secondary-container"></span>
                      <span className="w-3 h-3 rounded-full bg-tertiary/80"></span>
                      <span className="ml-2 font-label-caps text-label-caps uppercase text-on-surface font-bold tracking-wider hidden sm:inline">DigiStay Studio • Drag-and-Drop Visual Builder</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container font-label-md text-label-md text-on-surface">
                      <Icon name="lock" className="text-base text-tertiary" />
                      <span className="text-on-surface font-semibold">latelier-boutique.vn</span>
                      <span className="px-1.5 py-0.5 rounded bg-tertiary/15 text-tertiary text-xs uppercase font-bold">Live SSL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-surface-container-low font-label-caps text-label-caps uppercase text-on-surface-variant">Tự lưu 10:42 AM</span>
                      <span className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-caps text-label-caps uppercase font-bold shadow-sm flex items-center gap-1">
                        <Icon name="rocket_launch" className="text-sm" /> Xuất Bản
                      </span>
                    </div>
                  </div>

                  {/* Studio Workspace */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mt-4">
                    {/* Left: Visual Palette */}
                    <div className="lg:col-span-4 rounded-2xl bg-surface-container-low/70 border border-surface-container-high p-4 md:p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface font-bold flex items-center gap-1.5">
                            <Icon name="widgets" className="text-primary text-lg" /> Khối Giao Diện (Blocks)
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-label-caps text-label-caps font-bold">Kéo thả</span>
                        </div>

                        <div className="space-y-2.5">
                          {[
                            { icon: 'view_carousel', title: 'Hero + Direct Booking Bar', desc: 'Header, video nền & bộ chọn ngày', color: 'bg-primary-fixed/60 text-primary' },
                            { icon: 'bed', title: 'Hạng Phòng & Realtime Rate', desc: 'Thẻ phòng, slider ảnh & nút cọc', color: 'bg-tertiary-fixed/60 text-tertiary' },
                            { icon: 'qr_code_2', title: 'VietQR Napas247 Instant Pay', desc: 'Tự sinh mã QR ngân hàng kèm số tiền', color: 'bg-secondary-fixed/60 text-secondary' },
                            { icon: 'restaurant', title: 'Dịch Vụ Đi Kèm & Ẩm Thực', desc: 'Bữa sáng, BBQ villa, tour trekking', color: 'bg-surface-container-highest text-on-surface' },
                          ].map((item, i) => (
                            <div key={i} className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex items-center justify-between hover:border-primary transition-colors cursor-pointer group">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center`}>
                                  <Icon name={item.icon} className="text-lg" />
                                </div>
                                <div>
                                  <span className="font-label-lg text-label-lg font-bold text-on-surface block group-hover:text-primary transition-colors">{item.title}</span>
                                  <span className="font-label-md text-label-md text-on-surface-variant">{item.desc}</span>
                                </div>
                              </div>
                              <Icon name="drag_indicator" className="text-outline text-lg" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Property Switcher */}
                      <div className="mt-4 pt-3 border-t border-surface-container-high rounded-xl bg-surface-container p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-tertiary text-on-tertiary flex items-center justify-center font-bold text-xs">LA</div>
                          <div>
                            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Đang hiệu chỉnh</span>
                            <span className="font-label-lg text-label-lg font-bold text-on-surface">L'Atelier Dalat Villa</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary font-label-caps text-label-caps font-bold">12 Phòng</span>
                      </div>
                    </div>

                    {/* Right: Website Preview */}
                    <div className="lg:col-span-8 rounded-2xl bg-surface overflow-hidden border border-outline-variant/20 shadow-inner flex flex-col justify-between">
                      <div className="relative w-full h-80 md:h-[370px] bg-cover bg-center flex flex-col justify-between p-4 md:p-6 text-on-primary" style={{ backgroundImage: 'linear-gradient(to top, rgba(27,28,26,0.95) 0%, rgba(27,28,26,0.4) 40%, rgba(0,0,0,0.3) 100%), url(https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=1200)' }}>
                        <div className="relative z-10 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-headline-sm text-on-surface font-bold tracking-tight text-on-primary">L&apos;Atelier Boutique Villa</span>
                            <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest/25 backdrop-blur-md text-on-primary font-label-caps text-label-caps">Đà Lạt</span>
                          </div>
                          <div className="hidden sm:flex items-center gap-4 text-xs font-semibold">
                            <span>Hạng Phòng</span>
                            <span>Trải Nghiệm</span>
                            <span>Liên Hệ</span>
                            <span className="px-3 py-1 rounded-full bg-primary text-white">Đặt Trực Tiếp</span>
                          </div>
                        </div>

                        <div className="relative z-10 max-w-md">
                          <span className="px-2.5 py-1 rounded bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider">Ưu Đãi Độc Quyền Website -10%</span>
                          <h3 className="text-2xl md:text-3xl font-bold mt-1 text-white">Kỳ Nghỉ Thư Thái Giữa Rừng Thông Biệt Lập</h3>
                        </div>

                        {/* Booking Bar */}
                        <div className="relative z-10 bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl p-2.5 md:p-3 text-on-surface shadow-2xl border border-white/40">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="p-2 rounded-xl bg-surface-container-low">
                              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Nhận phòng</span>
                              <span className="font-label-lg text-label-lg font-bold text-on-surface">24 Tháng 05</span>
                            </div>
                            <div className="p-2 rounded-xl bg-surface-container-low">
                              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Trả phòng</span>
                              <span className="font-label-lg text-label-lg font-bold text-on-surface">26 Tháng 05</span>
                            </div>
                            <div className="p-2 rounded-xl bg-surface-container-low">
                              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Số khách</span>
                              <span className="font-label-lg text-label-lg font-bold text-on-surface">2 Người lớn</span>
                            </div>
                            <div className="flex items-center">
                              <button className="w-full h-full py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-1.5 shadow-md hover:bg-primary-container transition-all">
                                <Icon name="lock_clock" className="text-lg" />
                                <span>Khóa Phòng</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sync Status Bar */}
                      <div className="p-3 bg-surface-container-low flex flex-wrap items-center justify-between gap-2 border-t border-surface-container text-xs">
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <Icon name="sync" className="text-tertiary text-lg" />
                          <span>Đồng bộ 2 chiều: <strong>Agoda, Booking.com, Airbnb</strong> qua iCal & Channel API</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-tertiary">
                          <span className="w-2 h-2 rounded-full bg-tertiary animate-ping"></span>
                          <span>Khóa chống Overbooking 15 Phút kích hoạt</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          </ParallaxZoomSection>

          {/* SECTION 2: 4 TRỤ CỘT TÍNH NĂNG */}
          <section className="py-space-xl lg:py-margin-lg bg-surface-container-low/60" id="tinh-nang">
            <div className="max-w-7xl mx-auto px-margin-sm lg:margin">
              <Section className="text-center max-w-3xl mx-auto mb-space-xl">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold">Hệ Thống SaaS Toàn Diện</span>
                <h2 className="mt-space-xs font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">
                  4 Trụ Cột Đột Phá Doanh Thu Đặt Phòng Trực Tiếp
                </h2>
                <p className="mt-space-xs font-body-lg text-body-md md:text-body-lg text-on-surface-variant">
                  Thay thế hoàn toàn bảng chữ dài dòng bằng các công cụ vận hành thông minh, trực quan và tự động hóa 100%.
                </p>
              </Section>

              {/* Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
                {/* Card 1: No-Code Builder */}
                <Section className="md:col-span-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-space-lg shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-fixed text-primary font-label-caps text-label-caps uppercase font-bold">
                        <Icon name="draw" className="text-base" /> Trụ Cột 01
                      </div>
                      <span className="font-label-caps text-label-caps uppercase text-tertiary font-bold">Block Builder Framework</span>
                    </div>
                    <h3 className="font-headline-md text-on-surface mt-space-sm font-bold">
                      Trình Dựng Web Kéo Thả No-Code Chuyên Biệt Khách Sạn
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-xl">
                      Tự do tùy biến 16+ khối giao diện chuẩn hospitality: Khối Hero, Bảng tìm phòng, Slider Hạng phòng, Thực đơn F&B và Đánh giá 5 sao chuẩn SEO Google.
                    </p>

                    <div className="mt-space-md grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { icon: 'view_carousel', title: 'Hero Banner', status: 'Ready', color: 'text-primary' },
                        { icon: 'travel_explore', title: 'Booking Bar', status: 'Realtime', color: 'text-tertiary' },
                        { icon: 'king_bed', title: 'Room Gallery', status: 'WebP HD', color: 'text-secondary' },
                        { icon: 'restaurant_menu', title: 'F&B Menu', status: 'Interactive', color: 'text-primary' },
                      ].map((item, i) => (
                        <div key={i} className="p-3 rounded-2xl bg-surface-container-low border border-surface-container-high text-center">
                          <Icon name={item.icon} className={`text-2xl ${item.color} mx-auto`} />
                          <span className="font-label-md text-label-md font-bold text-on-surface block mt-1">{item.title}</span>
                          <span className="text-xs text-tertiary font-bold uppercase">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-space-md pt-space-sm border-t border-surface-container flex items-center justify-between text-on-surface-variant font-label-md text-label-md">
                    <span className="flex items-center gap-1.5"><Icon name="smartphone" className="text-tertiary text-lg" /> Chuẩn di động 100%</span>
                    <span className="flex items-center gap-1.5"><Icon name="bolt" className="text-tertiary text-lg" /> Tốc độ tải trang &lt; 1.2s</span>
                  </div>
                </Section>

                {/* Card 2: Booking Engine */}
                <Section className="md:col-span-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-space-lg shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary-fixed text-tertiary font-label-caps text-label-caps uppercase font-bold">
                        <Icon name="calendar_month" className="text-base" /> Trụ Cột 02
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-error/10 text-error font-label-caps text-label-caps font-bold">Khóa 15 Phút</span>
                    </div>
                    <h3 className="font-headline-md text-on-surface mt-space-sm font-bold">
                      Booking Engine & Khóa Giữ Phòng
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                      Loại bỏ nỗi lo Overbooking với cơ chế khóa phòng tạm 15 phút và lưới Timeline quản lý phòng theo ngày trực quan.
                    </p>

                    <div className="mt-space-md rounded-2xl bg-surface-container-low p-3 border border-surface-container-high space-y-2">
                      <div className="flex justify-between items-center text-xs text-on-surface-variant font-semibold pb-1 border-b border-surface-container">
                        <span>Hạng Phòng</span>
                        <div className="flex gap-3">
                          <span>T2 24/5</span>
                          <span>T3 25/5</span>
                          <span>T4 26/5</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-on-surface">Deluxe Pine (101)</span>
                        <div className="flex gap-2">
                          <span className="px-2 py-1 rounded bg-tertiary/20 text-tertiary font-bold">Direct (Đã Cọc)</span>
                          <span className="px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed">OTA Agoda</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-on-surface">Villa Garden (202)</span>
                        <div className="flex gap-2">
                          <span className="px-3 py-1 rounded bg-primary/20 text-primary font-bold animate-pulse">Đang Khóa 14:28</span>
                          <span className="px-2 py-1 rounded bg-tertiary/20 text-tertiary font-bold">Trống</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-space-md pt-space-sm border-t border-surface-container flex items-center justify-between text-xs text-on-surface-variant">
                    <span className="font-semibold text-tertiary flex items-center gap-1">
                      <Icon name="sync" className="text-base" /> Đồng bộ 2 chiều iCal / API
                    </span>
                    <span>Báo qua Telegram Bot</span>
                  </div>
                </Section>

                {/* Card 3: VietQR Payment */}
                <Section className="md:col-span-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-space-lg shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-caps text-label-caps uppercase font-bold">
                        <Icon name="qr_code_2" className="text-base" /> Trụ Cột 03
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary font-label-caps text-label-caps font-bold">Napas247</span>
                    </div>
                    <h3 className="font-headline-md text-on-surface mt-space-sm font-bold">
                      VietQR Tự Động & Hóa Đơn VAT
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                      Tiền cọc chuyển thẳng vào tài khoản ngân hàng của bạn trong 3 giây. Webhook tự động khớp lệnh đơn và xuất hóa đơn MISA meInvoice.
                    </p>

                    <div className="mt-space-md rounded-2xl bg-surface-container-low p-3.5 border border-surface-container-high flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-white p-1.5 shadow-sm border border-outline-variant/30 flex items-center justify-center shrink-0">
                        <Icon name="qr_code_2" className="text-5xl text-primary" />
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-tertiary font-bold">
                          <Icon name="check_circle" className="text-base" />
                          <span>Khớp cọc: 1.200.000 đ</span>
                        </div>
                        <p className="text-on-surface-variant">VietinBank • STK: 108871928xxx</p>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-highest text-xs font-bold text-on-surface">
                          <Icon name="receipt_long" className="text-sm text-tertiary" /> Xuất HĐĐT MISA meInvoice
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-space-md pt-space-sm border-t border-surface-container flex items-center justify-between text-xs text-on-surface-variant">
                    <span>54 Ngân hàng thành viên</span>
                    <span className="font-bold text-tertiary">0% Phí trung gian cọc</span>
                  </div>
                </Section>

                {/* Card 4: Multi-Property */}
                <Section className="md:col-span-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-space-lg shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-fixed text-primary font-label-caps text-label-caps uppercase font-bold">
                        <Icon name="apartment" className="text-base" /> Trụ Cột 04
                      </div>
                      <span className="font-label-caps text-label-caps uppercase text-secondary font-bold">Multi-Tenant Cloud</span>
                    </div>
                    <h3 className="font-headline-md text-on-surface mt-space-sm font-bold">
                      1 Tài Khoản Quản Lý Chuỗi Đa Cơ Sở & Tên Miền Riêng
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-xl">
                      Tách biệt dữ liệu tài chính cho từng homestay, resort. Gắn tên miền thương hiệu riêng (CNAME) với chứng chỉ bảo mật SSL tự kích hoạt trong 60 giây.
                    </p>

                    <div className="mt-space-md grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { num: '01', name: 'The Dalat Pine', domain: 'thedalatpine.vn • SSL Ok', color: 'bg-primary text-white' },
                        { num: '02', name: 'An Bang Beach Villa', domain: 'anbangvilla.com • SSL Ok', color: 'bg-tertiary text-white' },
                        { num: '03', name: 'Sapa Misty Retreat', domain: 'sapamisty.digistay.vn', color: 'bg-secondary text-white' },
                      ].map((item, i) => (
                        <div key={i} className="p-3 rounded-2xl bg-surface-container-low border border-surface-container-high">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-md ${item.color} text-xs font-bold flex items-center justify-center`}>{item.num}</div>
                            <span className="font-label-md text-label-md font-bold text-on-surface">{item.name}</span>
                          </div>
                          <span className="text-xs text-tertiary block mt-1 font-semibold">{item.domain}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-space-md pt-space-sm border-t border-surface-container flex items-center justify-between text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1"><Icon name="lock" className="text-base text-tertiary" /> Bảo mật cấp ngân hàng</span>
                    <span>Phân quyền 3 cấp (Owner, Manager, Staff)</span>
                  </div>
                </Section>
              </div>
            </div>
          </section>

          {/* SECTION 3: TEMPLATE SHOWCASE */}
          <section className="py-space-xl lg:py-margin-lg" id="mau-giao-dien">
            <div className="max-w-7xl mx-auto px-margin-sm lg:margin">
              <Section className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl">
                <div className="max-w-2xl">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold">Thư Viện Giao Diện May Đo</span>
                  <h2 className="mt-space-xs font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">
                    Bộ Mẫu Giao Diện Boutique Chuẩn Quốc Tế
                  </h2>
                  <p className="mt-space-xs font-body-lg text-body-md md:text-body-lg text-on-surface-variant">
                    Được thiết kế riêng cho từng ngôn ngữ kiến trúc nghỉ dưỡng. Tối ưu tỷ lệ chuyển đổi đặt cọc phòng ngay từ lần chạm đầu tiên.
                  </p>
                </div>
                <a href="#dang-ky-dung-thu" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-colors">
                  <span>Xem tất cả 24+ mẫu</span>
                  <Icon name="arrow_forward" className="text-lg" />
                </a>
              </Section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                <AnimatedSection animation="fade-up" delay={0} duration={700}>
                  <TiltCard3D tiltStrength={12} className="h-full">
                    <GlowCard glowColor="169, 49, 25" className="h-full">
                      <TemplateCard
                        name="Mẫu 'Hội An Memories'"
                        description="Tông màu vàng đất ấm, gạch bông cổ điển, phù hợp biệt thự di sản, homestay phố cổ và villa phong cách Đông Dương."
                        category="Indochine Heritage"
                        image="https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600"
                        tags={['Widget Đặt Nhanh', 'F&B Showcase']}
                      />
                    </GlowCard>
                  </TiltCard3D>
                </AnimatedSection>
                <AnimatedSection animation="fade-up" delay={100} duration={700}>
                  <TiltCard3D tiltStrength={12} className="h-full">
                    <GlowCard glowColor="169, 49, 25" className="h-full">
                      <TemplateCard
                        name="Mẫu 'Nordic Pine Valley'"
                        description="Cửa kính kịch trần, gỗ thông ấm áp, tối giản nội thất. Hoàn hảo cho homestay Đà Lạt, Sa Pa, Ba Vì, Tam Đảo."
                        category="Modern Minimalist"
                        image="https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=600"
                        tags={['Lưới Lịch Phòng', 'VietQR 3s']}
                        isPopular
                      />
                    </GlowCard>
                  </TiltCard3D>
                </AnimatedSection>
                <AnimatedSection animation="fade-up" delay={200} duration={700}>
                  <TiltCard3D tiltStrength={12} className="h-full">
                    <GlowCard glowColor="169, 49, 25" className="h-full">
                      <TemplateCard
                        name="Mẫu 'Azure Ocean Retreat'"
                        description="Không gian biển mở, tích hợp đặt dịch vụ Spa, bể bơi vô cực và tour canoe ngắm hoàng hôn chuyên nghiệp."
                        category="Coastal Luxury"
                        image="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600"
                        tags={['Add-on Tour', 'Multi-Currency']}
                      />
                    </GlowCard>
                  </TiltCard3D>
                </AnimatedSection>
              </div>
            </div>
          </section>

          {/* SECTION 4: OTA COMPARISON */}
          <section className="py-space-xl bg-surface-container-low/70" id="so-sanh">
            <div className="max-w-7xl mx-auto px-margin-sm lg:margin">
              <Section className="text-center max-w-3xl mx-auto mb-space-xl">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold">Giải Phóng Lợi Nhuận</span>
                <h2 className="mt-space-xs font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">
                  Nỗi Đau Phụ Thuộc OTA vs. Sức Mạnh Nền Tảng DigiStay
                </h2>
                <p className="mt-space-xs font-body-lg text-body-md md:text-body-lg text-on-surface-variant">
                  Tại sao các boutique hotel hàng đầu đều đang dịch chuyển mạnh mẽ sang kênh Direct Booking?
                </p>
              </Section>

              <Section className="overflow-x-auto">
                <div className="min-w-[700px] rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-md p-space-md">
                  <div className="grid grid-cols-12 pb-space-sm border-b border-surface-container font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant px-3">
                    <div className="col-span-4 font-bold text-on-surface">Tiêu Chí Trọng Yếu</div>
                    <div className="col-span-4 text-error font-bold flex items-center gap-1">
                      <Icon name="cancel" className="text-base" /> Bán Qua Sàn OTA
                    </div>
                    <div className="col-span-4 text-tertiary font-bold flex items-center gap-1">
                      <Icon name="check_circle" className="text-base" /> Website Direct DigiStay
                    </div>
                  </div>

                  {[
                    { label: 'Phí hoa hồng mỗi đơn', ota: 'Mất 15% – 25% doanh thu', direct: '0% Hoa hồng vĩnh viễn', highlight: true },
                    { label: 'Dòng tiền về tài khoản', ota: 'Giam vốn 15 đến 45 ngày', direct: 'Tài khoản nhận sau 3 giây (VietQR)', highlight: false },
                    { label: 'Sở hữu dữ liệu khách hàng', ota: 'Bị ẩn Email, SĐT (OTA giữ độc quyền)', direct: 'Sở hữu 100% CRM để remarketing lại', highlight: true },
                    { label: 'Nhận diện thương hiệu', ota: 'Bị so sánh giá trực tiếp với đối thủ', direct: 'Website tên miền riêng đẳng cấp', highlight: false },
                    { label: 'Kế toán & Hóa đơn VAT', ota: 'Đối soát thủ công, hóa đơn nước ngoài khó', direct: 'Tự động phát hành HĐĐT MISA meInvoice', highlight: true },
                  ].map((row, i) => (
                    <div key={i} className={`grid grid-cols-12 py-space-sm items-center rounded-xl px-3 my-1.5 ${row.highlight ? 'bg-surface-container-low/40' : ''}`}>
                      <div className="col-span-4 font-label-lg text-label-lg font-bold text-on-surface">{row.label}</div>
                      <div className="col-span-4 font-body-md text-body-md text-error flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-error"></span>
                        <span>{row.ota}</span>
                      </div>
                      <div className="col-span-4 font-body-md text-body-md text-tertiary font-bold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                        <span>{row.direct}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </section>

          {/* SECTION 5: ROI CALCULATOR */}
          <section className="py-space-xl lg:py-margin-lg" id="tinh-roi">
            <div className="max-w-5xl mx-auto px-margin-sm lg:margin">
              <ROICalculator />
            </div>
          </section>

          {/* SECTION 6: PRICING */}
          <section className="py-space-xl bg-surface-container-low" id="bang-gia">
            <div className="max-w-7xl mx-auto px-margin-sm lg:margin">
              <Section className="text-center max-w-3xl mx-auto mb-space-xl">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold">Chi Phí Minh Bạch - Không Phí Ẩn</span>
                <h2 className="mt-space-xs font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">
                  Bảng Giá Dịch Vụ SaaS DigiStay
                </h2>
                <p className="mt-space-xs font-body-lg text-body-md md:text-body-lg text-on-surface-variant">
                  Tuyệt đối không thu % hoa hồng doanh thu. Giữ trọn 100% dòng tiền của bạn.
                </p>
              </Section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter items-stretch">
                <PricingCard
                  name="Starter"
                  price="990.000"
                  period="đ / tháng"
                  description="Dành cho homestay từ 1 - 5 phòng bắt đầu xây dựng kênh đặt phòng trực tiếp."
                  features={[
                    'Tối đa 5 phòng vận hành',
                    'Trình dựng kéo thả Block Builder',
                    'Cổng VietQR Napas247 tự động 3s',
                    'Subdomain .digistay.vn miễn phí',
                    'Bảo mật SSL Cloudflare cấp tốc'
                  ]}
                  badge="Homestay Nhỏ"
                />
                <PricingCard
                  name="Boutique Pro"
                  price="1.990.000"
                  period="đ / tháng"
                  description="Dành cho Khách sạn Boutique & Villa nghỉ dưỡng từ 5 - 25 phòng tối ưu lợi nhuận."
                  features={[
                    'Lên đến 25 phòng & 3 Workspace',
                    'Gắn Tên Miền Riêng (Custom Domain)',
                    'Khóa giữ phòng Anti-Overbooking 15p',
                    'Đồng bộ 2 chiều OTA (iCal / Booking / Agoda)',
                    'Tích hợp hóa đơn điện tử MISA meInvoice',
                    'Báo tin đơn cọc mới qua Telegram Bot'
                  ]}
                  isPopular
                  badge="Phổ Biến Nhất Cho Boutique Hotel"
                />
                <PricingCard
                  name="Enterprise"
                  price="Tùy Chỉnh"
                  period="Liên hệ chuyên gia"
                  description="Dành cho tập đoàn lưu trú hoặc chuỗi đa cơ sở quy mô lớn cần hạ tầng riêng biệt."
                  features={[
                    'Không giới hạn phòng & Chi nhánh',
                    'Database riêng biệt cách ly tuyệt đối',
                    'Mở Open API kết nối hệ thống PMS',
                    'Custom module F&B, Spa theo yêu cầu',
                    'Kỹ sư hỗ trợ onboarding 1-on-1 24/7'
                  ]}
                  badge="Chuỗi Nghỉ Dưỡng"
                />
              </div>
            </div>
          </section>

          {/* SECTION 7: CTA FORM */}
          <section className="py-space-xl lg:py-margin-lg" id="dang-ky-dung-thu">
            <div className="max-w-6xl mx-auto px-margin-sm lg:margin">
              <Section className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-space-lg sm:margin shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-space-lg">
                <div className="max-w-xl text-left">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold">Khởi Đầu Tự Chủ Doanh Thu</span>
                  <h2 className="mt-space-xs font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface font-bold tracking-tight">
                    Sở Hữu Kênh Đặt Phòng Trực Tiếp Trong 15 Phút.
                  </h2>
                  <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
                    Không cần biết code. Không yêu cầu thẻ tín dụng để đăng ký. Đội ngũ chuyên gia DigiStay hỗ trợ đưa hình ảnh & dữ liệu phòng lên website miễn phí.
                  </p>
                  <div className="mt-space-md flex flex-wrap items-center gap-space-sm text-on-surface font-label-md text-label-md">
                    <span className="flex items-center gap-1"><Icon name="verified" className="text-tertiary text-lg" /> 14 ngày dùng thử full tính năng</span>
                    <span className="flex items-center gap-1"><Icon name="verified" className="text-tertiary text-lg" /> Tự cấp tên miền SSL trong 60s</span>
                  </div>
                </div>

                {/* Signup Form */}
                <form onSubmit={handleSubmit} className="w-full md:w-88 rounded-2xl bg-surface-container-low border border-surface-container-high p-space-md shadow-sm space-y-3.5 text-left">
                  <div>
                    <label className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1">Tên Khách sạn / Homestay</label>
                    <input
                      type="text"
                      placeholder="VD: The Dalat Pine Retreat"
                      value={formData.hotelName}
                      onChange={(e) => setFormData({ ...formData, hotelName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1">Số điện thoại liên hệ</label>
                    <input
                      type="tel"
                      placeholder="090x xxx xxx"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1">Quy mô cơ sở</label>
                    <select
                      value={formData.scale}
                      onChange={(e) => setFormData({ ...formData, scale: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="1-5">Dưới 5 phòng (Homestay / Villa nhỏ)</option>
                      <option value="5-20">Từ 5 - 20 phòng (Boutique Hotel)</option>
                      <option value="20+">Trên 20 phòng hoặc Chuỗi đa cơ sở</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-md hover:bg-primary-container transition-all flex items-center justify-center gap-2">
                    <span>Tạo Website Ngay Miễn Phí</span>
                    <Icon name="arrow_forward" className="text-lg" />
                  </button>
                  <span className="text-xs text-center block text-on-surface-variant">Bảo mật thông tin 100% theo tiêu chuẩn PCI-DSS</span>
                </form>
              </Section>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low mt-space-xl pt-space-xl pb-space-lg border-t border-surface-container">
        <div className="max-w-7xl mx-auto px-margin-sm lg:margin">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-gutter-lg pb-space-xl">
            <div className="lg:col-span-2 space-y-space-md">
              <div className="flex items-center gap-space-sm">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary">
                  <Icon name="villa" className="text-xl" />
                </div>
                <span className="font-headline-sm text-on-surface font-bold">DigiStay OS</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
                Hệ điều hành đặt phòng trực tiếp & Nền tảng thiết kế website chuyên biệt cho Boutique Hotels, Homestays & Khu nghỉ dưỡng tại Việt Nam. Tăng trưởng doanh thu trực tiếp không phụ thuộc OTA.
              </p>
              <div className="flex items-center gap-space-sm pt-space-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md">
                  <Icon name="location_on" className="text-tertiary text-base" />Hà Nội • TP. Hồ Chí Minh • Đà Lạt
                </span>
              </div>
            </div>

            <div className="space-y-space-sm">
              <h4 className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface font-bold">Giải Pháp</h4>
              <ul className="space-y-2.5 font-body-sm text-body-sm text-on-surface-variant">
                <li><a href="#tinh-nang" className="hover:text-primary transition-colors">Booking Engine Trực Tiếp</a></li>
                <li><a href="#tinh-nang" className="hover:text-primary transition-colors">Kéo Thả Web Khách Sạn</a></li>
                <li><a href="#tinh-nang" className="hover:text-primary transition-colors">Đồng Bộ Kênh OTA</a></li>
                <li><a href="#tinh-nang" className="hover:text-primary transition-colors">Quản Lý Trải Nghiệm Khách</a></li>
                <li><a href="#tinh-nang" className="hover:text-primary transition-colors">Cổng Thanh Toán VietQR</a></li>
              </ul>
            </div>

            <div className="space-y-space-sm">
              <h4 className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface font-bold">Khám Phá & Tài Nguyên</h4>
              <ul className="space-y-2.5 font-body-sm text-body-sm text-on-surface-variant">
                <li><a href="#mau-giao-dien" className="hover:text-primary transition-colors">Thư Viện Giao Diện Mẫu</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Cẩm Nang Vận Hành Homestay</a></li>
                <li><a href="#so-sanh" className="hover:text-primary transition-colors">So Sánh Lợi Nhuận OTA</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Tài Liệu Hướng Dẫn API</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Chính Sách Đối Tác</a></li>
              </ul>
            </div>

            <div className="space-y-space-sm">
              <h4 className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface font-bold">Bảo Mật & Thanh Toán</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Tích hợp chuẩn thanh toán nội địa và chứng nhận an toàn dữ liệu khách sạn quốc tế.
              </p>
              <div className="flex flex-wrap gap-2 pt-space-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-md text-label-md">
                  <Icon name="verified" className="text-tertiary text-lg" />VietQR PRO
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-md text-label-md">
                  <Icon name="lock" className="text-secondary text-lg" />PCI-DSS Level 1
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-md text-label-md">
                  <Icon name="shield" className="text-secondary text-lg" />SSL 256-Bit
                </div>
              </div>
            </div>
          </div>

          <div className="pt-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md text-on-surface-variant font-body-sm text-body-sm">
            <div className="flex flex-wrap items-center gap-space-md">
              <span>© 2026 DigiStay OS. Bản quyền thuộc về DigiStay Vietnam Co., Ltd.</span>
              <span className="hidden md:inline">•</span>
              <span className="text-tertiary font-label-md text-label-md flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>Hệ thống máy chủ hoạt động 99.98%
              </span>
            </div>
            <div className="flex items-center gap-gutter">
              <a href="#" className="hover:text-on-surface transition-colors">Điều Khoản Sử Dụng</a>
              <a href="#" className="hover:text-on-surface transition-colors">Bảo Mật Thông Tin</a>
              <a href="#" className="hover:text-on-surface transition-colors">Hỗ Trợ 24/7</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
