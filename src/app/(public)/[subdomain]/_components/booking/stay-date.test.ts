import { describe, it, expect } from 'vitest'
import { stayDate } from './StaySummary'

describe('stayDate', () => {
  it('spells a day the same on the server and in the browser', () => {
    expect(stayDate('2026-10-23', 'vi')).toBe('T6, 23/10/2026')
    expect(stayDate('2026-10-25', 'en', false)).toBe('Sun, 25/10')
  })
  it('reads a stored date in Vietnam time', () => {
    // Stored at midnight UTC (from yyyy-mm-dd), or late in the evening in Vietnam.
    expect(stayDate(new Date('2026-10-23T00:00:00Z'), 'vi')).toBe('T6, 23/10/2026')
    expect(stayDate(new Date('2026-10-23T18:30:00Z'), 'vi')).toBe('T7, 24/10/2026')
  })
})
