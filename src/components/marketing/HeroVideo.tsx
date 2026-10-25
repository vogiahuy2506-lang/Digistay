'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The home hero's looping video, laid over its poster photo. Loaded only
 * after the page has (the photo is the first paint), only from 768 px up,
 * and not for visitors who ask for reduced motion or to save data: they
 * keep the photo. It fades in once playing, plays only while on screen,
 * and has a pause button (anything moving for over 5 s must be stoppable).
 */
export function HeroVideo({ src, pauseLabel, playLabel }: { src: string; pauseLabel: string; playLabel: string }) {
  const ref = React.useRef<HTMLVideoElement>(null)
  const [enabled, setEnabled] = React.useState(false)
  const [playing, setPlaying] = React.useState(false)
  const [stopped, setStopped] = React.useState(false)
  const stoppedRef = React.useRef(false)

  React.useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)').matches
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    if (!wide || still || saveData) return
    if (document.readyState === 'complete') {
      setEnabled(true)
      return
    }
    const start = () => setEnabled(true)
    window.addEventListener('load', start, { once: true })
    return () => window.removeEventListener('load', start)
  }, [])

  React.useEffect(() => {
    const video = ref.current
    if (!enabled || !video) return
    video.muted = true
    const io = new IntersectionObserver(([entry]) => {
      if (stoppedRef.current) return
      if (entry.isIntersecting) video.play().catch(() => {})
      else video.pause()
    })
    io.observe(video)
    return () => io.disconnect()
  }, [enabled])

  if (!enabled) return null

  const toggle = () => {
    const video = ref.current
    if (!video) return
    stoppedRef.current = !stopped
    setStopped(!stopped)
    if (stopped) video.play().catch(() => {})
    else video.pause()
  }

  return (
    <>
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        onPlaying={() => setPlaying(true)}
        className={cn(
          'absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-[1200ms] ease-ds',
          playing ? 'opacity-100' : 'opacity-0',
        )}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={stopped ? playLabel : pauseLabel}
        className="absolute bottom-5 right-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors duration-160 hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:bottom-8 lg:right-8"
      >
        {stopped ? (
          <svg aria-hidden viewBox="0 0 16 16" className="ml-0.5 h-3.5 w-3.5 fill-current">
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
        ) : (
          <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
            <path d="M4 2.5h2.75v11H4zM9.25 2.5H12v11H9.25z" />
          </svg>
        )}
      </button>
    </>
  )
}
