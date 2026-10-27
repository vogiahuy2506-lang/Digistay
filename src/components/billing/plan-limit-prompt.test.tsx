// @vitest-environment happy-dom
/**
 * PlanLimitPrompt in a real (happy-dom) document: it watches the page's
 * fetches while mounted and opens the upgrade dialog for the API's plan
 * refusals only, leaving the page's own response readable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import billingVi from '../../../messages/dash/vi/billing.json'
import billingEn from '../../../messages/dash/en/billing.json'
import { PlanLimitPrompt, REOPEN_AFTER_MS } from './plan-limit-prompt'

const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let backend: ReturnType<typeof vi.fn>
let originalFetch: typeof window.fetch

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const PLAN_LIMIT = {
  success: false,
  error: 'Gói hiện tại cho phép tối đa 3 cơ sở. Nâng cấp gói trong Gói & thanh toán để thêm.',
  code: 'PLAN_LIMIT',
  limit: { kind: 'properties', used: 3, limit: 3, adding: 1, plan: 'growth', suggested: 'business' },
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  originalFetch = window.fetch
  backend = vi.fn(async () => json(200, { success: true }))
  window.fetch = backend as unknown as typeof window.fetch
  navigation.push.mockReset()
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.fetch = originalFetch
  vi.restoreAllMocks()
})

function mount({ canBuy = true, locale = 'vi' as 'vi' | 'en' } = {}) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale={locale} messages={{ dash: { billing: locale === 'vi' ? billingVi : billingEn } }}>
        <PlanLimitPrompt slug="khach-san-a" canBuy={canBuy} />
      </NextIntlClientProvider>,
    ),
  )
}

/** A page's request answered with `response`; returns what the page reads from it. */
async function request(response: Response, url = '/api/properties') {
  backend.mockResolvedValueOnce(response)
  let read: unknown
  await act(async () => {
    const res = await window.fetch(url, { method: 'POST' })
    read = await res.json().catch(() => null)
    // The prompt reads its clone of the body on its own time.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return read
}

const dialog = () => document.querySelector('[role="dialog"]')
const button = (text: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)

describe('PlanLimitPrompt', () => {
  it('shows the limit, the plan that fits with its price, and leads to the plan page', async () => {
    mount()
    const read = await request(json(403, PLAN_LIMIT))
    // The page still gets the whole answer.
    expect(read).toEqual(PLAN_LIMIT)

    const text = dialog()?.textContent ?? ''
    expect(text).toContain('Đã dùng hết số cơ sở của gói Growth')
    expect(text).toContain('Gói Growth cho phép tối đa 3 cơ sở, workspace đang dùng 3.')
    const offer = document.querySelector('[data-testid="plan-offer"]')?.textContent ?? ''
    expect(offer).toContain('Gói Business: tối đa 10 cơ sở')
    // formatVnd keeps the amount and ₫ together with a no-break space.
    expect(offer).toMatch(/10\.000\s₫\/tháng/)

    act(() => button('Nâng cấp gói')!.click())
    expect(navigation.push).toHaveBeenCalledWith('/workspace/khach-san-a/billing')
    expect(dialog()).toBeNull()
  })

  it('tells who may not buy the plan to ask the owner, with only a way to close', async () => {
    mount({ canBuy: false })
    await request(json(403, PLAN_LIMIT))
    expect(dialog()?.textContent).toContain('Nhờ chủ workspace nâng cấp gói.')
    expect(button('Nâng cấp gói')).toBeUndefined()
    expect(button('Để sau')).toBeUndefined()
    act(() => button('Đóng')!.click())
    expect(dialog()).toBeNull()
  })

  it('says how many rooms a change adds, and when no plan is big enough', async () => {
    mount()
    await request(json(403, { ...PLAN_LIMIT, limit: { kind: 'rooms', used: 295, limit: 300, adding: 12, plan: 'business', suggested: null } }))
    const text = dialog()?.textContent ?? ''
    expect(text).toContain('Gói Business cho phép tối đa 300 phòng, workspace đang dùng 295. Thao tác này thêm 12 phòng.')
    expect(text).toContain('Liên hệ Digistay để có gói riêng')
    expect(document.querySelector('[data-testid="plan-offer"]')).toBeNull()
    act(() => button('Liên hệ Digistay')!.click())
    expect(navigation.push).toHaveBeenCalledWith('/contact')
  })

  it('says Starter has no e-invoices', async () => {
    mount()
    await request(json(403, { ...PLAN_LIMIT, limit: { kind: 'invoices', used: 0, limit: 0, adding: 1, plan: 'starter', suggested: 'growth' } }))
    expect(dialog()?.textContent).toContain('Gói Starter không gồm hoá đơn điện tử')
    expect(document.querySelector('[data-testid="plan-offer"]')?.textContent).toContain('Gói Growth: 100 hoá đơn điện tử mỗi tháng')
  })

  it('offers to renew a read-only workspace and to see the plans for a locked property', async () => {
    mount()
    await request(json(402, { success: false, error: 'x', code: 'WORKSPACE_LOCKED' }))
    expect(dialog()?.textContent).toContain('Workspace đang chỉ xem vì gói đã hết hạn')
    act(() => button('Để sau')!.click())

    await request(json(402, { success: false, error: 'x', code: 'PROPERTY_PLAN_LOCKED' }))
    expect(dialog()?.textContent).toContain('Cơ sở này đang bị khoá vì workspace dùng vượt gói')
    act(() => button('Xem gói')!.click())
    expect(navigation.push).toHaveBeenCalledWith('/workspace/khach-san-a/billing')
  })

  it('speaks English on English pages', async () => {
    mount({ locale: 'en' })
    await request(json(403, PLAN_LIMIT))
    const text = dialog()?.textContent ?? ''
    expect(text).toContain('All properties of the Growth plan are in use')
    expect(document.querySelector('[data-testid="plan-offer"]')?.textContent).toContain('Business plan: up to 10 properties')
    expect(button('Upgrade plan')).toBeDefined()
  })

  it('stays out of the way of everything else', async () => {
    mount()
    expect(await request(json(200, { success: true, code: 'PLAN_LIMIT' }))).toEqual({ success: true, code: 'PLAN_LIMIT' })
    await request(json(403, { success: false, error: 'Bạn không có quyền tạo cơ sở trong workspace này' }))
    await request(json(400, { success: false, code: 'PLAN_LIMIT' }))
    await request(json(403, PLAN_LIMIT), 'https://api.cloudinary.com/api/upload')
    await request(json(403, PLAN_LIMIT), '/workspace/khach-san-a')
    await request(new Response('<html>Forbidden</html>', { status: 403 }))
    expect(dialog()).toBeNull()
  })

  it('opens one dialog at a time and not again at once for the same refusal', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    mount()
    await request(json(403, PLAN_LIMIT))
    await request(json(402, { success: false, code: 'WORKSPACE_LOCKED' }))
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(dialog()?.textContent).toContain('Đã dùng hết số cơ sở')

    act(() => button('Để sau')!.click())
    now += 1_000
    // The page retries: same code and kind, too soon.
    await request(json(403, PLAN_LIMIT))
    expect(dialog()).toBeNull()
    // Another kind is another refusal.
    await request(json(403, { ...PLAN_LIMIT, limit: { ...PLAN_LIMIT.limit, kind: 'staff', used: 10, limit: 10 } }))
    expect(dialog()?.textContent).toContain('Đã dùng hết tài khoản nhân viên của gói Growth')
    act(() => button('Để sau')!.click())

    now += REOPEN_AFTER_MS
    await request(json(403, PLAN_LIMIT))
    expect(dialog()?.textContent).toContain('Đã dùng hết số cơ sở')
  })

  it('puts the original fetch back when unmounted', async () => {
    mount()
    expect(window.fetch).not.toBe(backend)
    act(() => root.unmount())
    expect(window.fetch).toBe(backend)
    root = createRoot(container)
  })
})
