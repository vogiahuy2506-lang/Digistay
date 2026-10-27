// @vitest-environment happy-dom
/**
 * NumberInput in a real (happy-dom) document: thousands separators by
 * language, plain digits out, and Backspace next to a separator.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import { NumberInput } from './number-input'

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

/** A field holding its own value, as a form would, reporting each change. */
function Field({ locale, initial, onDigits }: { locale: 'vi' | 'en'; initial: string; onDigits: (d: string) => void }) {
  const [value, setValue] = React.useState(initial)
  return (
    <NextIntlClientProvider locale={locale} messages={{}}>
      <NumberInput
        aria-label="amount"
        value={value}
        onValueChange={(d) => {
          onDigits(d)
          setValue(d)
        }}
      />
    </NextIntlClientProvider>
  )
}

const input = () => container.querySelector('input') as HTMLInputElement

/** Types `text` as the whole value, the way React sees a change. */
function type(text: string, caret = text.length) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    input().focus()
    setter.call(input(), text)
    input().setSelectionRange(caret, caret)
    input().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('NumberInput', () => {
  it('shows thousands with a dot in Vietnamese and a comma in English', () => {
    act(() => root.render(<Field locale="vi" initial="1500000" onDigits={() => {}} />))
    expect(input().value).toBe('1.500.000')
    expect(input().inputMode).toBe('numeric')
    act(() => root.render(<Field locale="en" initial="1500000" onDigits={() => {}} key="en" />))
    expect(input().value).toBe('1,500,000')
  })

  it('reports plain digits as one types, and regroups', () => {
    const onDigits = vi.fn()
    act(() => root.render(<Field locale="vi" initial="" onDigits={onDigits} />))
    type('100')
    type('1000')
    expect(onDigits).toHaveBeenLastCalledWith('1000')
    expect(input().value).toBe('1.000')
    type('1.0005')
    expect(onDigits).toHaveBeenLastCalledWith('10005')
    expect(input().value).toBe('10.005')
    type('')
    expect(onDigits).toHaveBeenLastCalledWith('')
    expect(input().value).toBe('')
  })

  it('deletes the digit before a separator on Backspace', () => {
    const onDigits = vi.fn()
    act(() => root.render(<Field locale="vi" initial="1500000" onDigits={onDigits} />))
    act(() => {
      input().focus()
      // Caret right after the first dot: "1.|500.000".
      input().setSelectionRange(2, 2)
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))
    })
    expect(onDigits).toHaveBeenLastCalledWith('500000')
    expect(input().value).toBe('500.000')
  })
})
