import { describe, it, expect } from 'vitest'
import {
  categoryKey,
  groupMenuItems,
  isMenuImageUrl,
  localizeMenuItems,
  menuOrder,
  moveMenuGroup,
  moveMenuItem,
  sortMenuItems,
} from './menu'

type Item = { id: string; name: string; category: string | null; sortOrder: number; description: string | null; translations?: unknown }
const item = (id: string, name: string, category: string | null, sortOrder = 0, translations?: unknown): Item => ({
  id,
  name,
  category,
  sortOrder,
  description: null,
  translations,
})

const names = (items: { name: string }[]) => items.map((i) => i.name)

describe('menu order', () => {
  it('sorts by sortOrder, then name in Vietnamese order, then id', () => {
    const items = [item('c', 'Đậu hũ', null, 1), item('b', 'Cơm', null, 1), item('a', 'Trà', null, 0), item('e', 'Bún', null, 1), item('d', 'Bún', null, 1)]
    expect(sortMenuItems(items).map((i) => i.id)).toEqual(['a', 'd', 'e', 'b', 'c'])
    // Vietnamese order: Đ after D, before E.
    expect(names(sortMenuItems([item('1', 'Em', null), item('2', 'Đu đủ', null), item('3', 'Dưa', null)]))).toEqual(['Dưa', 'Đu đủ', 'Em'])
  })

  it('does not change the list it is given', () => {
    const items = [item('b', 'B', null, 2), item('a', 'A', null, 1)]
    sortMenuItems(items)
    expect(items.map((i) => i.id)).toEqual(['b', 'a'])
  })
})

describe('menu groups', () => {
  it('groups by category ignoring case and spaces, each group where its first item is', () => {
    const groups = groupMenuItems([
      item('1', 'Cà phê', 'Đồ uống', 3),
      item('2', 'Phở bò', 'Món chính', 0),
      item('3', 'Trà đá', '  đồ   uống ', 1),
      item('4', 'Cơm tấm', 'MÓN CHÍNH', 2),
      item('5', 'Bánh flan', null, 4),
      item('6', 'Chè', '   ', 5),
    ])
    expect(groups.map((g) => [g.category, names(g.items)])).toEqual([
      ['Món chính', ['Phở bò', 'Cơm tấm']],
      ['đồ uống', ['Trà đá', 'Cà phê']],
      [null, ['Bánh flan', 'Chè']],
    ])
    expect(groups.map((g) => g.key)).toEqual(['món chính', 'đồ uống', ''])
  })

  it('keys a category the same however it is typed', () => {
    expect(categoryKey(' Đồ  Uống ')).toBe(categoryKey('đồ uống'))
    expect(categoryKey(null)).toBe('')
    expect(categoryKey('  ')).toBe('')
  })

  it('moves an item inside its group and stops at the edges', () => {
    const groups = groupMenuItems([item('a', 'A', 'X', 0), item('b', 'B', 'X', 1), item('c', 'C', 'Y', 2), item('d', 'D', 'Y', 3)])
    expect(menuOrder(groups)).toEqual(['a', 'b', 'c', 'd'])
    expect(moveMenuItem(groups, 'b', -1)).toEqual(['b', 'a', 'c', 'd'])
    expect(moveMenuItem(groups, 'c', 1)).toEqual(['a', 'b', 'd', 'c'])
    // Never across a group's edge, so the groups keep their order.
    expect(moveMenuItem(groups, 'b', 1)).toBeNull()
    expect(moveMenuItem(groups, 'c', -1)).toBeNull()
    expect(moveMenuItem(groups, 'missing', 1)).toBeNull()
  })

  it('moves a whole group with its items', () => {
    const groups = groupMenuItems([item('a', 'A', 'X', 0), item('b', 'B', 'X', 1), item('c', 'C', 'Y', 2), item('d', 'D', null, 3)])
    expect(moveMenuGroup(groups, 'y', -1)).toEqual(['c', 'a', 'b', 'd'])
    expect(moveMenuGroup(groups, '', -1)).toEqual(['a', 'b', 'd', 'c'])
    expect(moveMenuGroup(groups, 'x', -1)).toBeNull()
    expect(moveMenuGroup(groups, '', 1)).toBeNull()
  })

  it('a stored order of ties becomes a strict one once moved', () => {
    // Every item still at the default sortOrder 0: the order is by name, and a move numbers them all.
    const groups = groupMenuItems([item('b', 'Bún', 'X'), item('a', 'Anh đào', 'X'), item('c', 'Chè', 'X')])
    expect(moveMenuItem(groups, 'c', -1)).toEqual(['a', 'c', 'b'])
  })
})

describe('menu in English', () => {
  it('uses the English texts and names a group after the first English category in it', () => {
    const items = [
      { ...item('1', 'Phở bò', 'Món chính', 0, { en: { name: 'Beef pho', description: 'With herbs' } }), description: 'Kèm rau' },
      item('2', 'Cơm tấm', 'món chính', 1, { en: { category: 'Mains' } }),
      item('3', 'Trà đá', 'Đồ uống', 2),
      item('4', 'Bánh flan', null, 3, { en: { category: 'Desserts' } }),
    ]
    const en = localizeMenuItems(items, 'en')
    expect(en.map((i) => [i.name, i.category, i.description])).toEqual([
      ['Beef pho', 'Mains', 'With herbs'],
      ['Cơm tấm', 'Mains', null],
      // No English category: the Vietnamese one stays.
      ['Trà đá', 'Đồ uống', null],
      // An English category on an item without a Vietnamese one names nothing.
      ['Bánh flan', null, null],
    ])
    expect(groupMenuItems(en).map((g) => g.category)).toEqual(['Mains', 'Đồ uống', null])
  })

  it('leaves Vietnamese as it is', () => {
    const items = [item('1', 'Phở bò', 'Món chính', 0, { en: { name: 'Beef pho', category: 'Mains' } })]
    expect(localizeMenuItems(items, 'vi')).toEqual(items)
  })
})

describe('menu photos', () => {
  it('takes http(s) URLs and files of our upload route', () => {
    expect(isMenuImageUrl('https://res.cloudinary.com/demo/image/upload/pho.jpg')).toBe(true)
    expect(isMenuImageUrl('http://example.com/pho.png')).toBe(true)
    expect(isMenuImageUrl('/api/upload/menu/pho-1.webp')).toBe(true)
  })

  it('refuses anything else', () => {
    for (const bad of [
      '',
      'data:image/png;base64,iVBORw0KGgo=',
      'javascript:alert(1)',
      '//evil.example/pho.jpg',
      '/uploads/pho.jpg',
      '/api/upload/../auth/session',
      '/api/upload/a b.jpg',
      'ftp://example.com/pho.jpg',
      'https://user:pass@example.com/pho.jpg',
      'pho.jpg',
      `https://example.com/${'a'.repeat(2048)}`,
    ]) {
      expect(isMenuImageUrl(bad), bad).toBe(false)
    }
  })
})
