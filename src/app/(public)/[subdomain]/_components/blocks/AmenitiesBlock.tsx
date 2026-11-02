'use client'

import * as React from 'react'
import { blockText } from '@/lib/i18n/content'
import { getIcon } from '@/lib/amenity-icons'
import { responsiveImage } from '@/lib/media/image-url'
import type { PublicAmenity, PublicBlock, PublicImage } from '../PropertySite'
import { Eyebrow, Section, SectionTitle } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Props {
  block: PublicBlock
  amenities: PublicAmenity[]
  images: PublicImage[]
}

/** Amenities: rich photo cards for amenities with photos + ruled list + interactive Lightbox. */
export function AmenitiesBlock({ block, amenities, images }: Props) {
  const locale = useLocale()
  const t = useTranslations('site.blocks.amenities')
  const cfg = block.config || {}
  const title = blockText(cfg, locale, 'amenitiesTitle', 'title') ?? t('title')
  const photo = images[2] ?? images[1] ?? images[0]

  // Amenities that have uploaded photos
  const photoAmenities = React.useMemo(
    () => amenities.filter((a) => Array.isArray(a.images) && a.images.length > 0),
    [amenities]
  )

  // Lightbox state
  const [activeAmenity, setActiveAmenity] = React.useState<PublicAmenity | null>(null)
  const [photoIndex, setPhotoIndex] = React.useState(0)

  const openLightbox = (amenity: PublicAmenity, index = 0) => {
    setActiveAmenity(amenity)
    setPhotoIndex(index)
  }

  const closeLightbox = () => {
    setActiveAmenity(null)
    setPhotoIndex(0)
  }

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!activeAmenity?.images?.length) return
    setPhotoIndex((prev) => (prev + 1) % activeAmenity.images!.length)
  }

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!activeAmenity?.images?.length) return
    setPhotoIndex((prev) => (prev - 1 + activeAmenity.images!.length) % activeAmenity.images!.length)
  }

  React.useEffect(() => {
    if (!activeAmenity) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight' && activeAmenity.images && activeAmenity.images.length > 1) {
        setPhotoIndex((p) => (p + 1) % activeAmenity.images!.length)
      }
      if (e.key === 'ArrowLeft' && activeAmenity.images && activeAmenity.images.length > 1) {
        setPhotoIndex((p) => (p - 1 + activeAmenity.images!.length) % activeAmenity.images!.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeAmenity])

  return (
    <Section id="amenities" className="bg-fg/[0.02]">
      <div>
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <SectionTitle>{title}</SectionTitle>

        {/* If there are amenities with photos, show a rich Visual Gallery Cards row */}
        {photoAmenities.length > 0 && (
          <div className="mt-8 mb-10">
            <h3 className="text-small font-medium text-fg uppercase tracking-wider mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-acc" />
              <span>{t('galleryTitle')}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {photoAmenities.map((item) => {
                const Icon = getIcon(item.icon)
                return (
                  <div
                    key={item.id}
                    onClick={() => openLightbox(item, 0)}
                    className="group relative rounded-xl overflow-hidden cursor-pointer border border-line bg-panel shadow-sm hover:shadow-md transition-all duration-200 aspect-[16/10]"
                  >
                    <img
                      src={item.images![0]}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

                    {/* Top badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                      {item.isFeatured ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-amber-400/30 shadow-sm">
                          ⭐ {t('featured')}
                        </span>
                      ) : <span />}
                      {item.images!.length > 1 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/90 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                          <Camera className="w-3 h-3" />
                          <span>{t('photosCount', { count: item.images!.length })}</span>
                        </span>
                      )}
                    </div>

                    {/* Bottom title & icon */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2.5 text-white pointer-events-none">
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-semibold text-sm sm:text-base drop-shadow-sm truncate">
                        {item.name}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Ruled / Categorized list of all amenities */}
        <div className={photo && photoAmenities.length === 0 ? 'grid gap-10 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-16' : ''}>
          <div>
            {amenities.length === 0 ? (
              <p className="mt-8 text-body text-muted">{t('empty')}</p>
            ) : (
              <ul className={`border-t border-line ${photo && photoAmenities.length === 0 ? '' : 'sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-x-10'}`}>
                {amenities.map((amenity) => {
                  const Icon = getIcon(amenity.icon)
                  const hasPhotos = Array.isArray(amenity.images) && amenity.images.length > 0
                  return (
                    <li
                      key={amenity.id}
                      className="flex items-center justify-between gap-3 border-b border-line py-3.5 text-body text-fg"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
                        <span className="truncate">{amenity.name}</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasPhotos && (
                          <button
                            type="button"
                            onClick={() => openLightbox(amenity, 0)}
                            className="inline-flex items-center gap-1 text-xs text-muted hover:text-acc transition-colors cursor-pointer"
                            title={t('viewPhotos')}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{amenity.images!.length}</span>
                          </button>
                        )}
                        {amenity.isFeatured && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-acc bg-acc/10 px-2 py-0.5 rounded border border-acc/20">
                            ⭐ {t('featured')}
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {photo && photoAmenities.length === 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...responsiveImage(photo.url, '(min-width: 1024px) 50vw, 100vw')} alt={photo.alt ?? title} loading="lazy" className="h-full min-h-[320px] w-full object-cover" />
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {activeAmenity && activeAmenity.images && activeAmenity.images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-panel rounded-2xl overflow-hidden shadow-2xl border border-line"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-fg text-base">{activeAmenity.name}</span>
                {activeAmenity.isFeatured && (
                  <span className="text-xs text-amber-500 font-medium">⭐ {t('featured')}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeAmenity.images.length > 1 && (
                  <span className="text-xs text-muted tabular-nums">
                    {photoIndex + 1} / {activeAmenity.images.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="p-1 rounded-full text-muted hover:text-fg hover:bg-fg/10 transition-colors"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Photo viewport */}
            <div className="relative flex-1 bg-black/90 flex items-center justify-center min-h-[320px] sm:min-h-[460px]">
              <img
                src={activeAmenity.images[photoIndex]}
                alt={`${activeAmenity.name} photo ${photoIndex + 1}`}
                className="max-h-[70vh] w-auto max-w-full object-contain select-none"
              />

              {activeAmenity.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevPhoto}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail selector if multiple */}
            {activeAmenity.images.length > 1 && (
              <div className="flex items-center gap-2 p-3 bg-panel border-t border-line overflow-x-auto">
                {activeAmenity.images.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoIndex(i)}
                    className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      i === photoIndex ? 'border-acc shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  )
}
