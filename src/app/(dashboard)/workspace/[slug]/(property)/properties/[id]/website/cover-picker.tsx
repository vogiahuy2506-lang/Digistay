'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PhotoUploadButton } from '@/components/ui/photo-upload'
import { resizedImage } from '@/lib/media/image-url'

interface Photo {
  id: string
  url: string
  alt?: string | null
}

/**
 * The Hero block's cover photo (config.backgroundImage, read by HeroBlock):
 * one of the property's photos, a new one uploaded here, or none (the
 * property's own first photo). An upload also joins the property's photos
 * (Tổng quan → Hình ảnh) when the user may add them (owner, admins); a
 * manager's upload is the cover only.
 */
export function CoverPicker({
  propertyId,
  photos,
  value,
  onChange,
  onPhotoAdded,
}: {
  propertyId: string
  photos: Photo[]
  value?: string
  onChange: (url: string | undefined) => void
  onPhotoAdded: (photo: Photo) => void
}) {
  const t = useTranslations('dash.website.config.cover')
  const tile = 'relative aspect-[4/3] overflow-hidden rounded-ctl border focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
  const usable = photos.filter((p) => !p.url.startsWith('data:'))

  const uploaded = async (url: string) => {
    onChange(url)
    const res = await fetch(`/api/properties/${propertyId}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (res?.ok && data?.data?.id) onPhotoAdded(data.data)
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-fg mb-1">{t('label')}</legend>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{t('hint')}</p>
        <PhotoUploadButton target={{ propertyId }} onUploaded={uploaded} />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-pressed={!value}
          className={cn(tile, 'flex items-center justify-center bg-fg/5 p-2 text-center text-xs text-muted', !value ? 'border-acc ring-2 ring-acc' : 'border-line hover:border-muted')}
        >
          {t('auto')}
        </button>
        {value && !usable.some((p) => p.url === value) && (
          <span className={cn(tile, 'border-acc ring-2 ring-acc')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resizedImage(value, 480)} alt={t('current')} className="h-full w-full object-cover" />
            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-acc text-on-ink">
              <Check className="h-3 w-3" aria-hidden="true" />
            </span>
          </span>
        )}
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
              <img src={resizedImage(photo.url, 480)} alt="" loading="lazy" className="h-full w-full object-cover" />
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
