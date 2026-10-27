import { describe, it, expect } from 'vitest'
import { caretAfterDigits, digitsBefore, digitsOf, groupDigits, thousandsSeparator } from './grouped-digits'

describe('grouped digits', () => {
  it('groups by thousands with the language’s separator', () => {
    expect(groupDigits('', '.')).toBe('')
    expect(groupDigits('999', '.')).toBe('999')
    expect(groupDigits('1000', '.')).toBe('1.000')
    expect(groupDigits('1500000', '.')).toBe('1.500.000')
    expect(groupDigits('1500000', thousandsSeparator('en'))).toBe('1,500,000')
    expect(thousandsSeparator('vi')).toBe('.')
  })

  it('keeps only the digits of what is typed or pasted, without leading zeros', () => {
    expect(digitsOf('1.500.000 ₫')).toBe('1500000')
    expect(digitsOf('1,500,000')).toBe('1500000')
    expect(digitsOf('00500')).toBe('500')
    expect(digitsOf('0')).toBe('0')
    expect(digitsOf('abc')).toBe('')
  })

  it('puts the caret back after the same digits once regrouped', () => {
    // "1.000" with the caret after "1.00", then a 5 typed: "1.0050" → "10.050", caret after "10.05".
    const typed = '1.0050'
    const count = digitsBefore(typed, 5)
    expect(count).toBe(4)
    expect(caretAfterDigits('10.050', count)).toBe(5)
    expect(caretAfterDigits('10.050', 0)).toBe(0)
    expect(caretAfterDigits('10.050', 9)).toBe(6)
  })
})
