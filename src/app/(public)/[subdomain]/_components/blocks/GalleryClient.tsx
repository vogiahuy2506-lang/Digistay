'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PublicImage } from '../PropertySite'
import { Section, SectionHeader } from '../site-ui'
import { useTranslations } from 'next-intl'
import { resizedImage, responsiveImage } from '@/lib/media/image-url'

interface Props {
  images: PublicImage[]
  title?: string
}

export function GalleryClient({ images, title }: Props) {
  const t = useTranslations('site.blocks.gallery')
  const [current, setCurrent] = useState(0)
  if (images.length === 0) return null

  const next = () => setCurrent((p) => (p + 1) % images.length)
  const prev = () => setCurrent((p) => (p - 1 + images.length) % images.length)
  const arrow =
    'absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center bg-panel/90 text-fg hover:bg-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'

  return (
    <Section id="gallery">
      <SectionHeader eyebrow={t('eyebrow')} title={title ?? t('title')} aside={t('count', { count: images.length })} />
      <div className="relative bg-fg/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...responsiveImage(images[current].url, '(min-width: 1280px) 1200px, 100vw')}
          alt={images[current].alt ?? t('photo', { n: current + 1, total: images.length })}
          loading="lazy"
          className="h-[300px] w-full object-cover sm:h-[520px]"
        />
        {images.length > 1 && (
          <>
            <button type="button" onClick={prev} className={`${arrow} left-4`} aria-label={t('previous')}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={next} className={`${arrow} right-4`} aria-label={t('next')}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="absolute bottom-4 right-4 bg-panel/90 px-2 py-0.5 text-xs text-fg tabular-nums" aria-live="polite">
              {current + 1} / {images.length}
            </p>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.slice(0, 6).map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              aria-current={i === current || undefined}
              className={`h-16 overflow-hidden sm:h-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc ${
                i === current ? 'ring-2 ring-acc ring-offset-2 ring-offset-page' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resizedImage(img.thumbnail ?? img.url, 480)}
                alt={img.alt ? t('viewWithAlt', { n: i + 1, alt: img.alt }) : t('view', { n: i + 1 })}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </Section>
  )
}
