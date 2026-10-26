import { describe, it, expect } from 'vitest'
import { foldVietnamese } from '@/lib/utils/fold'
import { matchOptions, type ComboboxOption } from './combobox'

const wards: ComboboxOption[] = [
  { value: '1', label: 'Phường Ba Đình' },
  { value: '2', label: 'Xã Ba Vì' },
  { value: '3', label: 'Phường Định Công' },
  { value: '4', label: 'Phường Hoàn Kiếm' },
  { value: '5', label: 'Phường Láng', keywords: 'Lang Ward' },
]
const labels = (query: string) => matchOptions(wards, query).map((o) => o.label)

describe('matchOptions', () => {
  it('shows everything for no text', () => {
    expect(labels('')).toHaveLength(5)
    expect(labels('   ')).toHaveLength(5)
  })

  it('finds by every typed word, without tone marks or case', () => {
    expect(labels('ba dinh')).toEqual(['Phường Ba Đình'])
    expect(labels('BA ĐÌNH')).toEqual(['Phường Ba Đình'])
    expect(labels('hoan kiem')).toEqual(['Phường Hoàn Kiếm'])
    expect(labels('ward')).toEqual(['Phường Láng'])
    expect(labels('xyz')).toEqual([])
  })

  it('puts the text starting the label first, then starting its second word, and so on', () => {
    expect(labels('dinh')).toEqual(['Phường Định Công', 'Phường Ba Đình'])
    expect(labels('xa ba')).toEqual(['Xã Ba Vì'])
    expect(labels('ba')).toEqual(['Phường Ba Đình', 'Xã Ba Vì'])
  })
})

describe('foldVietnamese', () => {
  it('folds tone marks, hats, đ, case and spaces, whichever way the tone is placed', () => {
    expect(foldVietnamese('  Thanh  Hoá ')).toBe('thanh hoa')
    expect(foldVietnamese('Thanh Hóa')).toBe('thanh hoa')
    expect(foldVietnamese('ĐẮK LẮK')).toBe('dak lak')
    expect(foldVietnamese('Xã Ea H’Leo')).toBe("xa ea h'leo")
  })
})
