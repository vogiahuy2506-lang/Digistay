'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  alt?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

export function Avatar({ src, alt, name, size = 'md', className }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false)

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        onError={() => setImageError(true)}
        className={cn(
          'rounded-full object-cover bg-plain-soft',
          sizeClasses[size],
          className
        )}
      />
    )
  }

  return (
    <div className={cn(
      'rounded-full bg-plain-soft text-fg font-medium flex items-center justify-center',
      sizeClasses[size],
      className
    )}>
      {name ? getInitials(name) : '?'}
    </div>
  )
}
