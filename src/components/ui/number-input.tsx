'use client'

/**
 * A whole-number field shown with thousands separators as it is typed
 * (1.000.000 in Vietnamese, 1,000,000 in English): money above all. What
 * goes in and comes out stays plain digits ("1000000", "" when emptied), so
 * forms and APIs see what they saw with type="number". The caret stays
 * after the same digits when the groups move, and Backspace / Delete next
 * to a separator removes the digit beyond it instead of doing nothing.
 *
 * Fields bounded well under a thousand (a percent, an age, guests) keep
 * type="number" and its arrows.
 */
import * as React from 'react'
import { useLocale } from 'next-intl'
import { caretAfterDigits, digitsBefore, digitsOf, groupDigits, thousandsSeparator } from '@/lib/grouped-digits'
import { Input } from './input'

type InputProps = React.ComponentProps<typeof Input>

export interface NumberInputProps extends Omit<InputProps, 'type' | 'value' | 'defaultValue' | 'onChange' | 'inputMode' | 'min' | 'max' | 'step'> {
  value: string | number | null | undefined
  /** Plain digits, "" when the field is emptied. */
  onValueChange: (digits: string) => void
  /** The most digits taken (15: well past any amount in đồng). */
  maxDigits?: number
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, maxDigits = 15, onKeyDown, placeholder, ...props }, ref) => {
    const separator = thousandsSeparator(useLocale())
    const inner = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => inner.current as HTMLInputElement)
    // Digits the caret should stand after once the new value is drawn.
    const caret = React.useRef<number | null>(null)
    // Redraws when the value did not change (a letter typed), to put the caret back.
    const [, redraw] = React.useReducer((n: number) => n + 1, 0)

    const digits = value === null || value === undefined ? '' : digitsOf(String(value))
    const shown = groupDigits(digits, separator)

    React.useLayoutEffect(() => {
      const el = inner.current
      if (caret.current === null || !el || document.activeElement !== el) return
      const at = caretAfterDigits(shown, caret.current)
      el.setSelectionRange(at, at)
      caret.current = null
    })

    const commit = (next: string, caretDigits: number) => {
      const clean = digitsOf(next).slice(0, maxDigits)
      // Leading zeros dropped: the caret moves left with them.
      const at = Math.max(0, Math.min(clean.length, caretDigits - (next.replace(/\D/g, '').length - digitsOf(next).length)))
      caret.current = at
      // Nothing new (a letter typed, a digit past maxDigits): React puts the
      // old text back with the caret at the end; the redraw moves it back.
      if (clean === digits) redraw()
      else onValueChange(clean)
    }

    return (
      <Input
        {...props}
        ref={inner}
        type="text"
        inputMode="numeric"
        // An example amount reads like the typed ones: "650000" shows as 650.000.
        placeholder={placeholder && /^\d+$/.test(placeholder) ? groupDigits(placeholder, separator) : placeholder}
        autoComplete={props.autoComplete ?? 'off'}
        value={shown}
        onChange={(e) => {
          const el = e.target
          commit(el.value, digitsBefore(el.value, el.selectionStart ?? el.value.length))
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          const el = e.currentTarget
          const at = el.selectionStart ?? 0
          if (e.defaultPrevented || at !== el.selectionEnd) return
          // Next to a separator the browser would delete only it, and the
          // regrouping would put it back: delete the digit beyond it.
          if (e.key === 'Backspace' && at > 1 && el.value[at - 1] === separator) {
            e.preventDefault()
            const before = digitsBefore(el.value, at)
            commit(el.value.slice(0, at - 2) + el.value.slice(at), before - 1)
          } else if (e.key === 'Delete' && el.value[at] === separator && at + 1 < el.value.length) {
            e.preventDefault()
            commit(el.value.slice(0, at) + el.value.slice(at + 2), digitsBefore(el.value, at))
          }
        }}
      />
    )
  }
)

NumberInput.displayName = 'NumberInput'
