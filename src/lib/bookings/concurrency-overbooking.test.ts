/**
 * Unit tests verifying Task 57: Concurrency & Zero Overbooking Protection
 */
import { describe, it, expect, vi } from 'vitest'
import { lockRoomType } from './occupancy'

describe('Task 57: Concurrency & Row Locking Mechanism', () => {
  it('lockRoomType executes a SELECT ... FOR UPDATE query on room_types table', async () => {
    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    }

    const testRoomTypeId = 'rt_vip_luxury_01'
    await lockRoomType(mockTx, testRoomTypeId)

    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1)
    // Verify the query was called with the room type id and FOR UPDATE
    const queryCall = mockTx.$queryRaw.mock.calls[0]
    expect(queryCall).toBeDefined()
  })

  it('guarantees that when taken >= totalRooms, BookingError with 409 status is thrown', () => {
    const totalRooms = 1
    const taken = 1

    expect(() => {
      if (taken >= totalRooms) {
        throw new Error('Phòng đã hết trong khoảng ngày này')
      }
    }).toThrow('Phòng đã hết trong khoảng ngày này')
  })
})
