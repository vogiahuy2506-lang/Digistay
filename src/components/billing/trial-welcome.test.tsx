// @vitest-environment happy-dom
/**
 * TrialWelcome in a real (happy-dom) document: it tells what the free trial
 * gives, and closing it any way marks it seen once.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import billingVi from '../../../messages/dash/vi/billing.json'
import commonVi from '../../../messages/dash/vi/common.json'
import billingEn from '../../../messages/dash/en/billing.json'
import commonEn from '../../../messages/dash/en/common.json'
import { TrialWelcome } from './trial-welcome'

const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let backend: ReturnType<typeof vi.fn>
let originalFetch: typeof window.fetch

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  originalFetch = window.fetch
  backend = vi.fn(async () => new Response('{"success":true}', { status: 200 }))
  window.fetch = backend as unknown as typeof window.fetch
  navigation.push.mockReset()
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.fetch = originalFetch
})

function mount(locale: 'vi' | 'en' = 'vi') {
  const dash = locale === 'vi' ? { billing: billingVi, common: commonVi } : { billing: billingEn, common: commonEn }
  act(() =>
    root.render(
      <NextIntlClientProvider locale={locale} messages={{ dash }}>
        {/* The trial ends on 10/11/2026, Vietnam time. */}
        <TrialWelcome workspaceId="ws1" workspaceName="Khách sạn Bờ Kè" slug="bo-ke" periodEnd="2026-11-09T17:00:00.000Z" days={14} planId="growth" />
      </NextIntlClientProvider>,
    ),
  )
}

const dialog = () => container.querySelector('[role=dialog]')
const button = (name: string) => [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent)?.trim() === name)!

describe('TrialWelcome', () => {
  it('says what the trial gives and until when', () => {
    mount()
    expect(dialog()?.getAttribute('aria-label')).toBe('Bạn được tặng 14 ngày dùng gói Growth miễn phí')
    const text = dialog()!.textContent!
    expect(text).toContain('Workspace Khách sạn Bờ Kè được dùng đầy đủ gói Growth đến ngày 10/11/2026')
    for (const line of ['Tối đa 3 cơ sở', 'Tối đa 60 phòng', '10 tài khoản nhân viên', '100 hoá đơn điện tử mỗi tháng']) expect(text).toContain(line)
  })

  it('closes and is marked seen once', async () => {
    mount()
    await act(async () => button('Bắt đầu sử dụng').click())
    expect(dialog()).toBeNull()
    expect(backend).toHaveBeenCalledTimes(1)
    expect(backend.mock.calls[0][0]).toBe('/api/workspaces/ws1/subscription/welcome')
    expect(backend.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true })
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('leads to the plans, also marking it seen', async () => {
    mount()
    await act(async () => button('Xem các gói').click())
    expect(navigation.push).toHaveBeenCalledWith('/workspace/bo-ke/billing')
    expect(backend).toHaveBeenCalledTimes(1)
  })

  it('in English', () => {
    mount('en')
    expect(dialog()?.getAttribute('aria-label')).toBe('You get 14 days of the Growth plan, free')
    expect(button('Close')).toBeTruthy()
  })
})
