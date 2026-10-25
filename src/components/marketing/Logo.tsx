import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Digistay's own logo: the red "D" seal and the serif word (brand, never on
 * hotel sites). public/marketing/logo.png is the light-theme file cut tight
 * from public/logo_full_digistay.png; logo-dark.png has light lettering.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const height = size === 'md' ? 'h-[30px]' : 'h-[26px]'
  return (
    <span className="flex items-center">
      <Image src="/marketing/logo.png" alt="Digistay" width={405} height={96} className={cn(height, 'w-auto dark:hidden')} />
      <Image src="/marketing/logo-dark.png" alt="Digistay" width={405} height={96} className={cn(height, 'hidden w-auto dark:block')} />
    </span>
  )
}
