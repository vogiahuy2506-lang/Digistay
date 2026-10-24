'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Photo {
  id: string
  url: string
  alt?: string | null
}

/**
 * The Hero block's cover photo (config.backgroundImage, read by HeroBlock):
 * one of the property's photos, or none (the property's own first photo).
 * No upload here: /api/upload has no storage behind it yet (src/lib/cloudinary
 * returns the file back as a data: URL), so photos are added to the property
 * first (Tổng quan → Hình ảnh), by link.
 */
export function CoverPicker({
  photos,
  value,
  onChange,
}: {
  photos: Photo[]
  value?: string
  onChange: (url: string | undefined) => void
}) {
  const t = useTranslations('dash.website.config.cover')
  const tile = 'relative aspect-[4/3] overflow-hidden rounded-ctl border focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
  const usable = photos.filter((p) => !p.url.startsWith('data:'))

  return (
    <fieldset>
      <legend className="text-sm font-medium text-fg mb-1">{t('label')}</legend>
      <p className="mb-2 text-xs text-muted">{t('hint')}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-pressed={!value}
          className={cn(tile, 'flex items-center justify-center bg-fg/5 p-2 text-center text-xs text-muted', !value ? 'border-acc ring-2 ring-acc' : 'border-line hover:border-muted')}
        >
          {t('auto')}
        </button>
        {usable.slice(0, 15).map((photo) => {
          const selected = value === photo.url
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => onChange(photo.url)}
              aria-pressed={selected}
              aria-label={photo.alt || t('photo')}
              className={cn(tile, selected ? 'border-acc ring-2 ring-acc' : 'border-line hover:border-muted')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              {selected && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-acc text-on-ink">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {usable.length === 0 && <p className="mt-2 text-xs text-muted">{t('none')}</p>}
    </fieldset>
  )
}
