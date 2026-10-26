import { describe, it, expect } from 'vitest'
import {
  countUsage,
  isEmptyPlan,
  overKinds,
  planLocks,
  planUnlocks,
  withLocks,
  withUnlocks,
  type Holdings,
  type OverageLimits,
  type RoomTypeItem,
} from './overage-plan'

const STARTER: OverageLimits = { properties: 1, rooms: 15, staff: 3 }
const GROWTH: OverageLimits = { properties: 3, rooms: 60, staff: 10 }

const day = (n: number) => new Date(Date.UTC(2026, 9, n))
const prop = (id: string, created: number, lockedAt: Date | null = null) => ({ id, createdAt: day(created), planLockedAt: lockedAt })
const type = (id: string, propertyId: string, created: number, totalRooms: number, extra: Partial<RoomTypeItem> = {}): RoomTypeItem => ({
  id,
  propertyId,
  createdAt: day(created),
  planLockedAt: null,
  isActive: true,
  totalRooms,
  ...extra,
})
const member = (userId: string, joined: number, lockedAt: Date | null = null) => ({ userId, joinedAt: day(joined), planLockedAt: lockedAt })
const invite = (id: string, created: number) => ({ id, createdAt: day(created) })
const holdings = (h: Partial<Holdings>): Holdings => ({ properties: [], roomTypes: [], members: [], invitations: [], ...h })

describe('countUsage', () => {
  it('counts only what is not locked: a locked property takes its rooms with it', () => {
    const h = holdings({
      properties: [prop('a', 1), prop('b', 2, day(20))],
      roomTypes: [type('a1', 'a', 1, 10), type('a2', 'a', 2, 4, { planLockedAt: day(20) }), type('a3', 'a', 3, 7, { isActive: false }), type('b1', 'b', 2, 30)],
      members: [member('m1', 1), member('m2', 2, day(20))],
      invitations: [invite('i1', 3)],
    })
    expect(countUsage(h)).toEqual({ properties: 1, rooms: 10, staff: 2 })
  })
})

describe('overKinds', () => {
  it('lists the kinds used beyond the limit only', () => {
    expect(overKinds({ properties: 1, rooms: 16, staff: 3 }, STARTER)).toEqual(['rooms'])
    expect(overKinds({ properties: 1, rooms: 15, staff: 3 }, STARTER)).toEqual([])
  })
})

describe('planLocks', () => {
  it('locks nothing when everything fits', () => {
    const h = holdings({ properties: [prop('a', 1)], roomTypes: [type('a1', 'a', 1, 15)], members: [member('m1', 1)] })
    expect(isEmptyPlan(planLocks(h, STARTER))).toBe(true)
  })

  it('locks the newest properties first, then counts only the rooms left', () => {
    const h = holdings({
      properties: [prop('old', 1), prop('mid', 5), prop('new', 9)],
      roomTypes: [type('o1', 'old', 1, 10), type('m1', 'mid', 5, 20), type('n1', 'new', 9, 20)],
    })
    const plan = planLocks(h, STARTER)
    expect(plan.properties).toEqual(['new', 'mid'])
    expect(plan.roomTypes).toEqual([])
    expect(countUsage(withLocks(h, plan, day(26)))).toMatchObject({ properties: 1, rooms: 10 })
  })

  it('locks whole room types newest first until the rooms fit', () => {
    const h = holdings({
      properties: [prop('a', 1)],
      roomTypes: [type('t1', 'a', 1, 8), type('t2', 'a', 2, 6), type('t3', 'a', 3, 5), type('t4', 'a', 4, 4)],
    })
    // 23 rooms for 15: t4 (4) leaves 19, t3 (5) leaves 14.
    const plan = planLocks(h, STARTER)
    expect(plan.roomTypes).toEqual(['t4', 't3'])
    expect(countUsage(withLocks(h, plan, day(26))).rooms).toBe(14)
  })

  it('gives back a small type when a bigger, older one had to go anyway', () => {
    const h = holdings({
      properties: [prop('a', 1)],
      roomTypes: [type('base', 'a', 1, 5), type('big', 'a', 2, 10), type('small', 'a', 3, 2)],
    })
    // 17 for 15: "small" (2) alone leaves 15 — enough, nothing else.
    expect(planLocks(h, STARTER).roomTypes).toEqual(['small'])
    // 17 for 6: "small" leaves 15, "big" leaves 5; then "small" fits back (7 > 6: no).
    expect(planLocks(h, { ...STARTER, rooms: 6 }).roomTypes).toEqual(['small', 'big'])
    // 17 for 7: after "small" and "big" only 5 are left, and "small" fits back in.
    expect(planLocks(h, { ...STARTER, rooms: 7 }).roomTypes).toEqual(['big'])
  })

  it('skips types that are off, empty, already locked or of a locked property', () => {
    const h = holdings({
      properties: [prop('a', 1), prop('b', 2, day(20))],
      roomTypes: [
        type('a1', 'a', 1, 16),
        type('off', 'a', 5, 9, { isActive: false }),
        type('empty', 'a', 6, 0),
        type('done', 'a', 7, 3, { planLockedAt: day(20) }),
        type('b1', 'b', 8, 30),
      ],
    })
    expect(planLocks(h, STARTER).roomTypes).toEqual(['a1'])
  })

  it('revokes open invitations before locking members, newest first, never the owner (not in the list)', () => {
    const h = holdings({
      members: [member('m1', 1), member('m2', 2), member('m3', 3), member('m4', 4)],
      invitations: [invite('i1', 5), invite('i2', 6)],
    })
    // 6 seats for 3: both invitations, then the newest member.
    const plan = planLocks(h, STARTER)
    expect(plan.invitations).toEqual(['i2', 'i1'])
    expect(plan.members).toEqual(['m4'])
    expect(countUsage(withLocks(h, plan, day(26))).staff).toBe(3)
  })

  it('revokes only as many invitations as needed', () => {
    const h = holdings({ members: [member('m1', 1), member('m2', 2)], invitations: [invite('i1', 5), invite('i2', 6)] })
    const plan = planLocks(h, STARTER)
    expect(plan.invitations).toEqual(['i2'])
    expect(plan.members).toEqual([])
  })
})

describe('planUnlocks', () => {
  const locked = day(20)

  it('unlocks everything once the plan is big enough, properties with their rooms', () => {
    const h = holdings({
      properties: [prop('a', 1), prop('b', 2, locked), prop('c', 3, locked)],
      roomTypes: [type('a1', 'a', 1, 10), type('a2', 'a', 2, 6, { planLockedAt: locked }), type('b1', 'b', 2, 20), type('c1', 'c', 3, 20)],
      members: [member('m1', 1), member('m2', 2, locked)],
    })
    const plan = planUnlocks(h, GROWTH)
    expect(plan).toEqual({ properties: ['b', 'c'], roomTypes: ['a2'], members: ['m2'] })
    expect(overKinds(countUsage(withUnlocks(h, plan)), GROWTH)).toEqual([])
  })

  it('keeps a property locked when its rooms would not fit, and nothing over the limit comes back', () => {
    const h = holdings({
      properties: [prop('a', 1), prop('b', 2, locked)],
      roomTypes: [type('a1', 'a', 1, 50), type('b1', 'b', 2, 20)],
    })
    expect(planUnlocks(h, GROWTH).properties).toEqual([])
    expect(planUnlocks(h, { ...GROWTH, rooms: 70 }).properties).toEqual(['b'])
  })

  it('goes oldest-locked first and skips what does not fit for something smaller that does', () => {
    const h = holdings({
      properties: [prop('a', 1)],
      roomTypes: [
        type('base', 'a', 1, 10),
        type('first', 'a', 5, 8, { planLockedAt: day(10) }),
        type('second', 'a', 6, 3, { planLockedAt: day(12) }),
        type('third', 'a', 7, 2, { planLockedAt: day(12) }),
      ],
    })
    // 5 free: "first" (8) does not fit, "second" (3) does, then "third" (2).
    expect(planUnlocks(h, STARTER).roomTypes).toEqual(['second', 'third'])
    // 9 free: "first" comes back first, then nothing else fits.
    expect(planUnlocks(h, { ...STARTER, rooms: 19 }).roomTypes).toEqual(['first'])
  })

  it('unlocks a locked room type that was turned off: it counts for nothing', () => {
    const h = holdings({
      properties: [prop('a', 1)],
      roomTypes: [type('a1', 'a', 1, 15), type('off', 'a', 2, 9, { planLockedAt: locked, isActive: false })],
    })
    expect(planUnlocks(h, STARTER).roomTypes).toEqual(['off'])
  })

  it('unlocks members only while seats are free, the earliest locked first', () => {
    const h = holdings({
      members: [member('m1', 1), member('m2', 2, day(15)), member('m3', 3, day(10)), member('m4', 4, day(15))],
      invitations: [invite('i1', 5)],
    })
    // 2 used of 3: one seat, for the member locked first.
    expect(planUnlocks(h, STARTER).members).toEqual(['m3'])
  })

  it('does not undo what was just locked', () => {
    const h = holdings({
      properties: [prop('a', 1), prop('b', 2)],
      roomTypes: [type('a1', 'a', 1, 8), type('a2', 'a', 2, 6), type('a3', 'a', 3, 5)],
      members: [member('m1', 1), member('m2', 2), member('m3', 3), member('m4', 4)],
      invitations: [invite('i1', 5)],
    })
    const after = withLocks(h, planLocks(h, STARTER), day(26))
    expect(overKinds(countUsage(after), STARTER)).toEqual([])
    expect(isEmptyPlan(planUnlocks(after, STARTER))).toBe(true)
  })
})
