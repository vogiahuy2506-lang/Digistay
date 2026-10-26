import { describe, it, expect } from 'vitest'
import { createWorkspaceSchema, updateWorkspaceSchema, validationMessage } from './index'

describe('the workspace schemas', () => {
  it.each([null, '', undefined])('take %o as "no logo" and "no domain"', (value) => {
    expect(createWorkspaceSchema.safeParse({ name: 'QA Chuỗi Khách Sạn', logo: value, domain: value }).success).toBe(true)
    expect(updateWorkspaceSchema.safeParse({ name: 'Tên mới', logo: value, domain: value }).success).toBe(true)
  })

  it('takes a stored logo URL', () => {
    const logo = 'https://res.cloudinary.com/demo/image/upload/digistay/logo.png'
    expect(updateWorkspaceSchema.parse({ logo }).logo).toBe(logo)
  })

  it('refuses a logo that is not a URL, with its Vietnamese message', () => {
    const result = createWorkspaceSchema.safeParse({ name: 'QA', logo: 'logo.png' })
    expect(result.success).toBe(false)
    if (!result.success) expect(validationMessage(result.error)).toBe('Logo phải là URL hợp lệ')
  })

  it('answers zod’s own problems (a wrong type) in Vietnamese', () => {
    const result = createWorkspaceSchema.safeParse({ name: 'QA', logo: 42 })
    expect(result.success).toBe(false)
    if (!result.success) expect(validationMessage(result.error)).toBe('Dữ liệu không hợp lệ')

    const short = createWorkspaceSchema.safeParse({ name: 'Q' })
    if (!short.success) expect(validationMessage(short.error)).toBe('Tên workspace phải có ít nhất 2 ký tự')
  })
})
