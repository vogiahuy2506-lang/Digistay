'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

export function Loading({ size = 'md', className, text }: LoadingProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn(
        'rounded-full border-primary-200 border-t-primary-600 animate-spin',
        sizes[size]
      )} />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  )
}

export function PageLoading({ text = 'Đang tải...' }: { text?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Loading size="lg" text={text} />
    </div>
  )
}

export function OverlayLoading() {
  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
      <Loading size="lg" text="Đang xử lý..." />
    </div>
  )
}
