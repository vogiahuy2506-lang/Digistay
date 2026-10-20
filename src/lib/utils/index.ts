import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { typeScale } from '@/styles/tokens'

// Custom theme keys from tailwind.config.ts. Without them tailwind-merge reads
// `text-small` as a text color and drops it next to `text-muted`.
// cn.test.ts fails when tailwind.config.ts gains a key missing here.
export const customFontSizes = [
  ...Object.keys(typeScale),
  'display-hero', 'display-hero-mobile', 'headline-xl', 'headline-xl-mobile', 'headline-lg',
  'headline-lg-mobile', 'headline-md', 'headline-sm', 'title-md', 'body-lg', 'body-md', 'body-sm',
  'label-lg', 'label-md', 'label-caps',
]
export const customRadii = ['ctl', 'box']
export const customShadows = ['luxury', 'subtle', 'card', 'card-hover', 'glow', 'lift', 'drawer']
export const customEasings = ['ds']

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: customFontSizes }],
      rounded: [{ rounded: customRadii }],
      shadow: [{ shadow: customShadows }],
      ease: [{ ease: customEasings }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generateSlug(name: string, existingSlugs: string[] = []): string {
  const baseSlug = slugify(name)
  let slug = baseSlug
  let counter = 1

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

export function generateSubdomain(name: string): string {
  return slugify(name)
}

export function formatCurrency(amount: number, currency: string = 'VND'): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(0[0-9]{9,10})$/
  return phoneRegex.test(phone.replace(/\D/g, ''))
}

export function generateRandomToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export function calculateWeekdayPrice(basePrice: number, isWeekend: boolean, weekendSurcharge: number = 0): number {
  if (isWeekend) {
    return basePrice + (basePrice * weekendSurcharge / 100)
  }
  return basePrice
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

export function getDaysBetween(start: Date, end: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((end.getTime() - start.getTime()) / oneDay))
}

export function getVietnamTime(): Date {
  const now = new Date()
  const vietnamTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  return new Date(vietnamTimeString)
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular
  return plural || `${singular}s`
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2)
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif']
  const ext = getFileExtension(filename).toLowerCase()
  return imageExtensions.includes(ext)
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase()
}
