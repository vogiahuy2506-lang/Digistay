'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PublicImage } from '../PropertySite'

interface Props {
  images: PublicImage[]
  title?: string
}

export function GalleryClient({ images, title = 'Hình ảnh' }: Props) {
  const [current, setCurrent] = useState(0)

  if (images.length === 0) {
    return (
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-center mb-8"
            style={{ fontFamily: 'var(--brand-font-heading)' }}
          >
            {title}
          </h2>
          <p className="text-center text-gray-500">Chưa có hình ảnh nào.</p>
        </div>
      </section>
    )
  }

  const next = () => setCurrent((p) => (p + 1) % images.length)
  const prev = () => setCurrent((p) => (p - 1 + images.length) % images.length)

  return (
    <section id="gallery" className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-8"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>

        <div className="relative h-[300px] md:h-[500px] rounded-2xl overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[current].url}
            alt={images[current].alt ?? `Image ${current + 1}`}
            className="w-full h-full object-cover"
          />
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center"
            aria-label="Ảnh tiếp theo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition ${
                  i === current ? 'bg-white' : 'bg-white/50'
                }`}
                aria-label={`Ảnh ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {images.length > 1 && (
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mt-4">
            {images.slice(0, 6).map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`relative h-16 rounded-md overflow-hidden ${
                  i === current ? 'ring-2' : 'opacity-70'
                }`}
                style={
                  i === current
                    ? { boxShadow: '0 0 0 2px var(--brand-primary)' }
                    : undefined
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbnail ?? img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
