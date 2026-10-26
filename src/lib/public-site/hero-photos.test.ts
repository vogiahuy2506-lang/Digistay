import { describe, expect, it } from 'vitest'
import { middleOut, photoKey } from './hero-photos'

describe('hero photos', () => {
  it('the same photo at another size is one photo; different photos stay apart', () => {
    const cover = 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1600&h=900&fit=crop&q=75&fm=jpg'
    const gallery = 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&h=1200&fit=crop&q=75&fm=jpg'
    expect(photoKey(cover)).toBe(photoKey(gallery))
    expect(photoKey(cover)).not.toBe(photoKey('https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1600'))
    // A query that names the picture is kept.
    expect(photoKey('https://cdn.example.com/img.php?id=1&w=800')).not.toBe(photoKey('https://cdn.example.com/img.php?id=2&w=800'))
    expect(photoKey('not a url')).toBe('not a url')
  })

  it('the first photo takes the middle slot of the wide strip', () => {
    expect(middleOut(['cover', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual(['f', 'd', 'b', 'cover', 'c', 'e', 'g'])
    expect(middleOut(['cover', 'b', 'c', 'd'])).toEqual(['c', 'cover', 'b', 'd'])
    expect(middleOut(['cover'])).toEqual(['cover'])
    expect(middleOut([])).toEqual([])
  })
})
