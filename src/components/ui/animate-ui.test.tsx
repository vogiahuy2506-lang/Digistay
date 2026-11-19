// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
import { SlidingNumber } from './sliding-number'

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

describe('Animate UI components', () => {
  it('renders SlidingNumber with value, prefix and suffix', () => {
    act(() => {
      root.render(<SlidingNumber value="1500000" prefix="₫ " suffix=" /đêm" />)
    })

    expect(container.textContent).toContain('₫')
    expect(container.textContent).toContain('/đêm')
    expect(container.textContent).toContain('1')
    expect(container.textContent).toContain('5')
  })

  it('renders animated Tabs and switches active tabs', () => {
    function TabsDemo() {
      const [tab, setTab] = React.useState('all')
      return (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="segmented">
            <TabsTrigger value="all">Tất cả</TabsTrigger>
            <TabsTrigger value="checkin">Nhận phòng</TabsTrigger>
            <TabsTrigger value="staying">Đang ở</TabsTrigger>
          </TabsList>
          <TabsContent value="all">Nội dung tất cả</TabsContent>
          <TabsContent value="checkin">Nội dung nhận phòng</TabsContent>
          <TabsContent value="staying">Nội dung đang ở</TabsContent>
        </Tabs>
      )
    }

    act(() => {
      root.render(<TabsDemo />)
    })

    expect(container.textContent).toContain('Nội dung tất cả')
    expect(container.textContent).not.toContain('Nội dung nhận phòng')

    const checkinBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Nhận phòng'
    )
    expect(checkinBtn).toBeDefined()

    act(() => {
      checkinBtn?.click()
    })

    expect(container.textContent).toContain('Nội dung nhận phòng')
    expect(container.textContent).not.toContain('Nội dung tất cả')
  })

  it('supports underline variant for tabs', () => {
    act(() => {
      root.render(
        <Tabs defaultValue="overview">
          <TabsList variant="underline">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="details">Chi tiết</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Tab 1</TabsContent>
        </Tabs>
      )
    })

    expect(container.textContent).toContain('Tổng quan')
    expect(container.textContent).toContain('Chi tiết')
    expect(container.textContent).toContain('Tab 1')
  })
})
