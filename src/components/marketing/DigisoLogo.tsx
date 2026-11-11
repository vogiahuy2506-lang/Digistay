import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Official logo of DIGISO Digital Solutions Co., Ltd.
 * Displays color logo on light backgrounds and white logo on dark backgrounds.
 */
export function DigisoLogo({
  className,
  size = 'md',
  heightClass,
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  heightClass?: string
}) {
  const resolvedHeight = heightClass || (size === 'sm' ? 'h-5' : size === 'lg' ? 'h-8' : 'h-6')
  return (
    <span className={cn('inline-flex items-center', className)}>
      <Image
        src="/marketing/logo-digiso.png"
        alt="DIGISO Digital Solutions"
        width={150}
        height={38}
        className={cn(resolvedHeight, 'w-auto dark:hidden object-contain')}
      />
      <Image
        src="/marketing/logo-digiso-white.png"
        alt="DIGISO Digital Solutions"
        width={150}
        height={38}
        className={cn(resolvedHeight, 'w-auto hidden dark:block object-contain')}
      />
    </span>
  )
}
