// @vitest-environment happy-dom
/**
 * The confirm step of deleting (src/lib/deletion): the red button stays off
 * until the name is typed, and for good while something stops the deletion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import dash from '../../../messages/dash/vi'
import { ConfirmDeleteDialog, type ConfirmDeleteDialogProps } from './confirm-delete-dialog'

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

function render(props: Partial<ConfirmDeleteDialogProps> = {}) {
  const all: ConfirmDeleteDialogProps = {
    open: true,
    onClose: () => {},
    title: 'Xoá cơ sở Khách sạn Hồ Tây?',
    name: 'Khách sạn Hồ Tây',
    loading: false,
    facts: ['Biến mất ngay.'],
    confirmLabel: 'Xoá cơ sở',
    onConfirm: async () => null,
    ...props,
  }
  act(() =>
    root.render(
      <NextIntlClientProvider locale="vi" messages={{ dash }}>
        <ConfirmDeleteDialog {...all} />
      </NextIntlClientProvider>
    )
  )
}

const deleteButton = () => [...container.querySelectorAll('button[type=submit]')][0] as HTMLButtonElement
const nameInput = () => container.querySelector('[data-testid=confirm-delete-name]') as HTMLInputElement | null

function type(value: string) {
  const input = nameInput()!
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('ConfirmDeleteDialog', () => {
  it('turns the button on only once the name is typed, and sends what was typed', async () => {
    const onConfirm = vi.fn(async () => null)
    render({ onConfirm })
    expect(deleteButton().disabled).toBe(true)
    type('Khách sạn Hồ')
    expect(deleteButton().disabled).toBe(true)
    type('khách sạn hồ tây')
    expect(deleteButton().disabled).toBe(false)
    await act(async () => {
      deleteButton().form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onConfirm).toHaveBeenCalledWith('khách sạn hồ tây')
  })

  it('shows what the server refused', async () => {
    render({ onConfirm: async () => 'Cơ sở còn 2 đơn đặt phòng' })
    type('Khách sạn Hồ Tây')
    await act(async () => {
      deleteButton().form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(container.textContent).toContain('Cơ sở còn 2 đơn đặt phòng')
  })

  it('while blocked: says why, asks for no name, the button stays off', () => {
    render({ blocked: 'Còn 3 đơn đặt phòng của khách đang ở hoặc sắp đến.' })
    expect(container.querySelector('[data-testid=delete-blocked]')?.textContent).toContain('Còn 3 đơn')
    expect(nameInput()).toBeNull()
    expect(deleteButton().disabled).toBe(true)
  })
})
