'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

/**
 * Content of Digistay's public pages rises into view as it is scrolled to:
 * mark an element `data-reveal` (`data-reveal="rise"` for a longer move,
 * `style={revealDelay(ms)}` from ./styles to stagger it).
 * The hidden state lives in globals.css under `html[data-motion]`, which is
 * set only here, after whatever is already on screen has been marked shown,
 * so nothing on screen flashes. Without script, or with reduced motion
 * asked for, everything is simply there.
 */
export function RevealObserver() {
  const pathname = usePathname()

  // Layout effect: on a client-side navigation the new page's first screen
  // is marked shown before the browser paints it.
  React.useLayoutEffect(() => {
    const fold = window.innerHeight
    const pending: HTMLElement[] = []
    for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-shown])')) {
      if (el.getBoundingClientRect().top < fold) el.dataset.shown = ''
      else pending.push(el)
    }
    document.documentElement.dataset.motion = ''
    if (!pending.length) return
    if (!('IntersectionObserver' in window)) {
      for (const el of pending) el.dataset.shown = ''
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          ;(e.target as HTMLElement).dataset.shown = ''
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    for (const el of pending) io.observe(el)
    return () => io.disconnect()
  }, [pathname])

  return null
}
