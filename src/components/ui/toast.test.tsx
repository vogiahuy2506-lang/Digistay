// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import { ToastProvider, toast } from './toast'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
})

function mountApp(children: React.ReactNode = <div>App</div>) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="vi" messages={{ common: { close: 'Đóng' } }}>
        <ToastProvider>{children}</ToastProvider>
      </NextIntlClientProvider>
    )
  })
}

describe('Toast notification system', () => {
  it('displays success, error, warning, and info toasts', () => {
    mountApp()

    act(() => {
      toast.success('Đã lưu thành công', 'Cấu hình đã được lưu')
      toast.error('Lỗi kết nối', 'Không thể gửi dữ liệu')
      toast.warning('Cảnh báo', 'Vui lòng kiểm tra lại')
      toast.info('Thông tin', 'Hệ thống đang bảo trì')
    })

    const text = container.textContent || ''
    expect(text).toContain('Đã lưu thành công')
    expect(text).toContain('Cấu hình đã được lưu')
    expect(text).toContain('Lỗi kết nối')
    expect(text).toContain('Cảnh báo')
    expect(text).toContain('Thông tin')
  })

  it('supports options object with actions and custom callbacks', () => {
    mountApp()
    const onAction = vi.fn()

    act(() => {
      toast.success('Đã huỷ đặt phòng', {
        message: 'Mã phòng #101',
        action: { label: 'Hoàn tác', onClick: onAction, primary: true },
      })
    })

    expect(container.textContent).toContain('Đã huỷ đặt phòng')
    expect(container.textContent).toContain('Mã phòng #101')

    const actionButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Hoàn tác'
    )
    expect(actionButton).toBeDefined()

    act(() => {
      actionButton?.click()
    })
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('supports toast.loading and updating to success with same id', () => {
    mountApp()

    let toastId = ''
    act(() => {
      toastId = toast.loading('Đang tải dữ liệu...')
    })

    expect(container.textContent).toContain('Đang tải dữ liệu...')

    act(() => {
      toast.success('Tải dữ liệu hoàn tất', { id: toastId })
    })

    expect(container.textContent).toContain('Tải dữ liệu hoàn tất')
    expect(container.textContent).not.toContain('Đang tải dữ liệu...')
  })

  it('handles toast.promise for successful resolution', async () => {
    mountApp()

    const resolvePromise = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve('Kết quả A'), 100)
      })

    let promiseResult = ''
    act(() => {
      toast
        .promise(resolvePromise, {
          loading: 'Đang xử lý...',
          success: (res) => `Thành công: ${res}`,
          error: 'Thất bại',
        })
        .then((r) => {
          promiseResult = r
        })
    })

    expect(container.textContent).toContain('Đang xử lý...')

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(promiseResult).toBe('Kết quả A')
    expect(container.textContent).toContain('Thành công: Kết quả A')
    expect(container.textContent).not.toContain('Đang xử lý...')
  })

  it('handles toast.promise for rejection', async () => {
    mountApp()

    const rejectPromise = () =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Máy chủ bận')), 100)
      })

    let caughtError: Error | null = null
    act(() => {
      toast
        .promise(rejectPromise, {
          loading: 'Đang xử lý...',
          success: 'Thành công',
          error: (err: any) => `Lỗi: ${err.message}`,
        })
        .catch((e) => {
          caughtError = e
        })
    })

    expect(container.textContent).toContain('Đang xử lý...')

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect(container.textContent).toContain('Lỗi: Máy chủ bận')
  })

  it('supports toast.dismiss for specific id and all toasts', () => {
    mountApp()

    let id1 = ''
    let id2 = ''
    act(() => {
      id1 = toast.info('Toast 1', { duration: 0 })
      id2 = toast.info('Toast 2', { duration: 0 })
    })

    expect(container.textContent).toContain('Toast 1')
    expect(container.textContent).toContain('Toast 2')

    act(() => {
      toast.dismiss(id1)
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(container.textContent).not.toContain('Toast 1')
    expect(container.textContent).toContain('Toast 2')

    act(() => {
      toast.dismiss()
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(container.textContent).not.toContain('Toast 2')
  })

  it('caps max visible toasts to 4', () => {
    mountApp()

    act(() => {
      toast.info('Toast 1', { duration: 0 })
      toast.info('Toast 2', { duration: 0 })
      toast.info('Toast 3', { duration: 0 })
      toast.info('Toast 4', { duration: 0 })
    })

    expect(container.textContent).toContain('Toast 1')
    expect(container.textContent).toContain('Toast 4')

    act(() => {
      toast.info('Toast 5', { duration: 0 })
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(container.textContent).toContain('Toast 5')
    // Toast 1 should have been evicted to maintain max 4
    expect(container.textContent).not.toContain('Toast 1')
  })
})
