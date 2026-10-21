'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

export function Loading({ size = 'md', className, text }: LoadingProps) {
  const t = useTranslations('dash.ui.loading')
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
  }

  return (
    <div role="status" className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        aria-hidden="true"
        className={cn('rounded-full border-line border-t-fg animate-spin motion-reduce:animate-none', sizes[size])}
      />
      {text ? <p className="text-small text-muted">{text}</p> : <span className="sr-only">{t('label')}</span>}
    </div>
  )
}

export function PageLoading({ text }: { text?: string }) {
  const t = useTranslations('dash.ui.loading')
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Loading size="lg" text={text ?? t('page')} />
    </div>
  )
}

export function OverlayLoading() {
  const t = useTranslations('dash.ui.loading')
  return (
    <div className="fixed inset-0 bg-page/80 flex items-center justify-center z-50">
      <Loading size="lg" text={t('overlay')} />
    </div>
  )
}
