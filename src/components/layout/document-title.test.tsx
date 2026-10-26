// @vitest-environment happy-dom
/**
 * The dashboard's tab titles (useDocumentTitle): set while the page is
 * shown, put back when something else writes the <title> (Next's metadata),
 * and the replaced title restored when the page goes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useDocumentTitle } from './document-title'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Page({ parts }: { parts: (string | undefined)[] }) {
  useDocumentTitle(parts)
  return null
}

let container: HTMLDivElement
let root: Root
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  document.head.innerHTML = '<title>Digistay</title>'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('useDocumentTitle', () => {
  it('names the page and the hotel, skipping what is not known yet', () => {
    act(() => root.render(<Page parts={['Đặt phòng', undefined]} />))
    expect(document.title).toBe('Đặt phòng · Digistay')
    act(() => root.render(<Page parts={['Đặt phòng', 'Khách sạn Demo Hà Nội']} />))
    expect(document.title).toBe('Đặt phòng · Khách sạn Demo Hà Nội · Digistay')
  })

  it('puts its title back when the metadata writes another, and restores that one when the page goes', async () => {
    act(() => root.render(<Page parts={['Lịch phòng', 'KS']} />))
    document.querySelector('title')!.textContent = 'Digistay — trang chủ'
    await settle()
    expect(document.title).toBe('Lịch phòng · KS · Digistay')

    act(() => root.render(<></>))
    expect(document.title).toBe('Digistay — trang chủ')
  })
})
