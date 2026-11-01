// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { LiveCountdown } from './LiveCountdown'
import { StickyMobileBookingBar } from './StickyMobileBookingBar'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('LiveCountdown component', () => {
  it('renders countdown title and digits', () => {
    act(() => {
      root.render(
        <LiveCountdown
          title="Flash Sale Cuối Tuần"
          subtitle="Giảm 30%"
          buttonText="Đặt ngay"
          buttonLink="#rooms"
        />
      )
    })

    expect(container.textContent).toContain('Flash Sale Cuối Tuần')
    expect(container.textContent).toContain('Giảm 30%')
    expect(container.textContent).toContain('Đặt ngay')
    expect(container.textContent).toContain('Ngày')
    expect(container.textContent).toContain('Giờ')
    expect(container.textContent).toContain('Phút')
    expect(container.textContent).toContain('Giây')
  })
})

describe('StickyMobileBookingBar component', () => {
  it('renders starting price when visible after scroll', () => {
    act(() => {
      root.render(
        <StickyMobileBookingBar
          phone="0912345678"
          startingPrice="850.000₫"
        />
      )
    })

    // Before scroll, hidden
    expect(container.textContent).toBe('')

    // Trigger scroll
    Object.defineProperty(window, 'scrollY', { value: 350, writable: true })
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    expect(container.textContent).toContain('850.000₫')
    expect(container.textContent).toContain('Đặt ngay')
  })
})
