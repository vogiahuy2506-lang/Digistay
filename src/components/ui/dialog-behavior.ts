'use client'

import * as React from 'react'

/**
 * Behavior shared by Modal and SidePanel. Both render in place (no portal), so
 * they inherit the nearest data-theme.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Open dialogs, oldest first. Escape and Tab only act on the top one (a confirm
// modal opened from the side panel must not close the panel too).
const openDialogs: { token: symbol; el: HTMLElement }[] = []

// A dialog rendered inside another is on top of it, whatever the open order
// (children's effects run before their parent's when both open in one render);
// otherwise the most recently opened wins.
function topDialog(): symbol | undefined {
  for (let i = openDialogs.length - 1; i >= 0; i--) {
    const { token, el } = openDialogs[i]
    if (!openDialogs.some((other) => other.el !== el && el.contains(other.el))) return token
  }
  return undefined
}

let scrollLocks = 0
let savedOverflow = ''

function lockScroll() {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = savedOverflow
}

interface DialogBehaviorOptions {
  onEscape: () => void
  /** Keep Tab inside the dialog and stop the page behind from scrolling. */
  modal: boolean
}

/**
 * While `open`: moves focus into `ref` (unless an autoFocus child already has
 * it), closes on Escape when this is the top dialog, and in modal mode traps
 * Tab and locks page scroll. On close, focus goes back to where it was.
 */
export function useDialogBehavior(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  { onEscape, modal }: DialogBehaviorOptions
) {
  const onEscapeRef = React.useRef(onEscape)
  onEscapeRef.current = onEscape
  const modalRef = React.useRef(modal)
  modalRef.current = modal

  React.useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) return

    const token = Symbol('dialog')
    openDialogs.push({ token, el })
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (topDialog() !== token || event.defaultPrevented) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (event.key !== 'Tab' || !modalRef.current) return
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.getClientRects().length > 0
      )
      if (items.length === 0) {
        event.preventDefault()
        el.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === el || !el.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !el.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openDialogs.splice(
        openDialogs.findIndex((entry) => entry.token === token),
        1
      )
      if (previous && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [open, ref])

  React.useEffect(() => {
    if (!open || !modal) return
    lockScroll()
    return unlockScroll
  }, [open, modal])
}

/** Matches a media query on the client; false during server rendering. */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}
