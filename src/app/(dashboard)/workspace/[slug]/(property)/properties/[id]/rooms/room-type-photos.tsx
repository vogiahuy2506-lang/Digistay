'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Star, Trash2 } from 'lucide-react'
import { PhotoUploadButton } from '@/components/ui/photo-upload'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { resizedImage } from '@/lib/media/image-url'
import { cn } from '@/lib/utils'

export interface RoomTypePhoto {
  id: string
  url: string
  isPrimary: boolean
}

/**
 * The room type's photos, in the edit dialog: upload (several at once), make
 * one the main photo (the hotel site's room card), remove. Each change is
 * saved at once (/api/properties/[id]/room-types/[roomTypeId]/images), apart
 * from the dialog's own Save.
 */
export function RoomTypePhotos({
  propertyId,
  roomTypeId,
  photos,
  onChange,
}: {
  propertyId: string
  roomTypeId: string
  photos: RoomTypePhoto[]
  onChange: (photos: RoomTypePhoto[]) => void
}) {
  const t = useTranslations('dash.rooms.rooms.photos')
  const [busy, setBusy] = React.useState<string | null>(null)
  const titleId = React.useId()
  const base = `/api/properties/${propertyId}/room-types/${roomTypeId}/images`

  const send = async (init: RequestInit, url = base) => {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (res?.ok && data?.success) onChange(data.data)
    else toast.error(apiError(data?.error) || t('failed'))
  }

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id)
    try {
      await action()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div role="group" aria-labelledby={titleId} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={titleId} className="text-sm font-medium text-fg">{t('title')}</p>
        <PhotoUploadButton
          target={{ propertyId }}
          multiple
          onUploaded={(url) => send({ method: 'POST', body: JSON.stringify({ url }) })}
        />
      </div>
      {photos.length === 0 ? (
        <p className="rounded-box border border-dashed border-line p-4 text-center text-sm text-muted">{t('none')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className={cn('group relative aspect-[4/3] overflow-hidden rounded-ctl border', photo.isPrimary ? 'border-acc ring-2 ring-acc' : 'border-line')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resizedImage(photo.url, 480)} alt="" loading="lazy" className="h-full w-full object-cover" />
              {photo.isPrimary ? (
                <span className="absolute left-1 top-1 rounded bg-ink px-1.5 py-0.5 text-[11px] font-medium text-on-ink">{t('main')}</span>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(photo.id, () => send({ method: 'PATCH', body: JSON.stringify({ imageId: photo.id }) }))}
                  aria-label={t('makeMain')}
                  title={t('makeMain')}
                  className="absolute left-1 top-1 rounded bg-panel/90 p-1 text-fg transition-opacity hover:bg-panel sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                >
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (confirm(t('deleteConfirm'))) void run(photo.id, () => send({ method: 'DELETE' }, `${base}?imageId=${encodeURIComponent(photo.id)}`))
                }}
                aria-label={t('delete')}
                title={t('delete')}
                className="absolute right-1 top-1 rounded bg-err p-1 text-on-err transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">{t('hint')}</p>
    </div>
  )
}
