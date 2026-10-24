'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2, Upload } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'

interface Photo {
  id: string
  url: string
  alt?: string | null
}

const MAX_BYTES = 10 * 1024 * 1024

/**
 * The Hero block's cover photo (config.backgroundImage, read by HeroBlock):
 * one of the property's photos, a new upload (it joins the property's photos
 * too), or none: the property's own first photo.
 */
export function CoverPicker({
  propertyId,
  photos,
  value,
  onChange,
}: {
  propertyId: string
  photos: Photo[]
  value?: string
  onChange: (url: string | undefined) => void
}) {
  const t = useTranslations('dash.website.config.cover')
  const [extra, setExtra] = React.useState<Photo[]>([])
  const [uploading, setUploading] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const all = [...extra, ...photos.filter((p) => !extra.some((e) => e.url === p.url))]

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast.error(t('notImage'))
    if (file.size > MAX_BYTES) return toast.error(t('tooLarge'))
    setUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, folder: 'properties', propertyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success || !data.data?.url) {
        toast.error(apiError(data.error) || t('uploadFailed'))
        return
      }
      setExtra((list) => [{ id: data.data.publicId ?? data.data.url, url: data.data.url }, ...list])
      onChange(data.data.url)
    } catch {
      toast.error(t('uploadFailed'))
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const tile = 'relative aspect-[4/3] overflow-hidden rounded-ctl border focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
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
        {all.slice(0, 15).map((photo) => {
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
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className={cn(tile, 'flex flex-col items-center justify-center gap-1 border-dashed border-line text-xs text-muted hover:border-muted hover:text-fg disabled:opacity-60')}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {uploading ? t('uploading') : t('upload')}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />
    </fieldset>
  )
}
