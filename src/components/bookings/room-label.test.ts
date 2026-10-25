import { describe, it, expect } from 'vitest'
import { roomLabel } from './booking-detail'

const item = { id: 'i1', roomTypeId: 'std', roomTypeName: 'Standard', roomNumber: '101' }

describe('roomLabel (the printed slip)', () => {
  it('reads the room type and number of a stay in one room', () => {
    expect(roomLabel({ bookingItems: [item] })).toBe('Standard · 101')
    expect(roomLabel({ bookingItems: [] })).toBe('Chưa có phòng')
  })

  it("lists every room of a stay that changes rooms, with each one's nights", () => {
    const roomSegments = [
      { roomId: 'r101', roomNumber: '101', roomTypeId: 'std', roomTypeName: 'Standard', fromDate: '2026-12-09T17:00:00.000Z', toDate: '2026-12-11T17:00:00.000Z' },
      { roomId: 'r205', roomNumber: '205', roomTypeId: 'dlx', roomTypeName: null, fromDate: '2026-12-11T17:00:00.000Z', toDate: '2026-12-13T17:00:00.000Z' },
    ]
    expect(roomLabel({ bookingItems: [item], roomSegments })).toBe('Standard · 101 (10/12 – 12/12), Hạng phòng đã xoá · 205 (12/12 – 14/12)')
  })
})
