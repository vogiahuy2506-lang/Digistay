// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

let mockPathname: string | null = null

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}))

const mockHotel = {
  property: {
    name: 'Khách sạn Biển Xanh',
    type: 'HOTEL',
    city: 'Đà Nẵng',
    phone: '0905123456',
  },
}

let mockPreview = false

vi.mock('./site-base', () => ({
  useSiteHotel: () => mockHotel,
  useSiteHref: () => (path: string) => path,
  useIsPreview: () => mockPreview,
}))

import { StickyBookingBar } from './StickyBookingBar'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('StickyBookingBar', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockPathname = null
    mockPreview = false
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('renders safely without throwing when usePathname() returns null', () => {
    mockPathname = null
    expect(() => {
      act(() => {
        root.render(<StickyBookingBar />)
      })
    }).not.toThrow()

    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    expect(container.textContent).toContain('Khách sạn Biển Xanh')
  })

  it('renders correctly on home page', () => {
    mockPathname = '/'
    act(() => {
      root.render(<StickyBookingBar />)
    })
    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    const bookLink = container.querySelector('a[href="#rooms"]')
    expect(bookLink).not.toBeNull()
  })

  it('hides completely on booking flow pages like /dat-phong', () => {
    mockPathname = '/nhphuc/dat-phong'
    act(() => {
      root.render(<StickyBookingBar />)
    })
    const aside = container.querySelector('aside')
    expect(aside).toBeNull()
  })

  it('hides completely in preview mode', () => {
    mockPathname = '/'
    mockPreview = true
    act(() => {
      root.render(<StickyBookingBar />)
    })
    const aside = container.querySelector('aside')
    expect(aside).toBeNull()
  })
})
