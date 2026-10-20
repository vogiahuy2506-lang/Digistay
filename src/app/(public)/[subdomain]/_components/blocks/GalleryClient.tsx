'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PublicImage } from '../PropertySite'
import { Section, SectionHeader } from '../site-ui'

interface Props {
  images: PublicImage[]
  title?: string
}

export function GalleryClient({ images, title = 'Hình ảnh' }: Props) {
  const [current, setCurrent] = useState(0)
  if (images.length === 0) return null

  const next = () => setCurrent((p) => (p + 1) % images.length)
  const prev = () => setCurrent((p) => (p - 1 + images.length) % images.length)
  const arrow =
    'absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center bg-panel/90 text-fg hover:bg-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'

  return (
    <Section id="gallery">
      <SectionHeader eyebrow="Thư viện ảnh" title={title} aside={`${images.length} ảnh`} />
      <div className="relative bg-fg/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[current].url}
          alt={images[current].alt ?? `Ảnh ${current + 1} / ${images.length}`}
          className="h-[300px] w-full object-cover sm:h-[520px]"
        />
        {images.length > 1 && (
          <>
            <button type="button" onClick={prev} className={`${arrow} left-4`} aria-label="Ảnh trước">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={next} className={`${arrow} right-4`} aria-label="Ảnh tiếp theo">
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
                src={img.thumbnail ?? img.url}
                alt={img.alt ? `Xem ảnh ${i + 1}: ${img.alt}` : `Xem ảnh ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </Section>
  )
}
