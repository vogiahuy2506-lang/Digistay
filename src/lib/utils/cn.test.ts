import { describe, it, expect } from 'vitest'
import tailwindConfig from '../../../tailwind.config'
import { cn, customEasings, customFontSizes, customRadii, customShadows } from '.'

describe('cn', () => {
  it('keeps a custom font size next to a text color', () => {
    expect(cn('text-small text-muted')).toBe('text-small text-muted')
    expect(cn('text-label-caps', 'text-gray-500')).toBe('text-label-caps text-gray-500')
  })

  it('lets a later custom font size win over an earlier one', () => {
    expect(cn('text-small', 'text-body')).toBe('text-body')
    expect(cn('text-sm', 'text-small')).toBe('text-small')
  })

  it('merges custom radii, shadows and easing with the built-in ones', () => {
    expect(cn('rounded-ctl', 'rounded-full')).toBe('rounded-full')
    expect(cn('shadow-lift', 'shadow-none')).toBe('shadow-none')
    expect(cn('ease-ds', 'ease-in')).toBe('ease-in')
  })

  it('still lets a className override a role color', () => {
    expect(cn('bg-ink text-on-ink', 'bg-err')).toBe('text-on-ink bg-err')
  })

  it('knows every custom key in tailwind.config.ts', () => {
    const ext = tailwindConfig.theme?.extend ?? {}
    expect(Object.keys(ext.fontSize ?? {}).filter((k) => !customFontSizes.includes(k))).toEqual([])
    const defaultRadii = ['DEFAULT', 'lg', 'xl', '2xl', '3xl', 'full']
    expect(Object.keys(ext.borderRadius ?? {}).filter((k) => !defaultRadii.includes(k) && !customRadii.includes(k))).toEqual([])
    expect(Object.keys(ext.boxShadow ?? {}).filter((k) => k !== '2xl' && !customShadows.includes(k))).toEqual([])
    expect(Object.keys(ext.transitionTimingFunction ?? {}).filter((k) => !customEasings.includes(k))).toEqual([])
  })
})
