import { describe, it, expect } from 'vitest'
import { capacityProblem, hardCapacityProblem } from './capacity'

const room = { baseOccupancy: 2, maxOccupancy: 3, maxAdults: 2, maxChildren: 1 }

describe('capacityProblem', () => {
  it('accepts a consistent room type', () => {
    expect(capacityProblem(room)).toBeNull()
    // Fewer guests in total than adults + children: two adults, or one adult and a child.
    expect(capacityProblem({ baseOccupancy: 1, maxOccupancy: 2, maxAdults: 2, maxChildren: 1 })).toBeNull()
  })

  it('refuses more base guests than the maximum', () => {
    expect(capacityProblem({ ...room, baseOccupancy: 4 })).toBe('baseOverMax')
  })

  it('refuses more adults than the maximum', () => {
    expect(capacityProblem({ ...room, maxAdults: 4, maxChildren: 0 })).toBe('adultsOverMax')
  })

  it('refuses a maximum the adults and children cannot reach (the old form saved 2 adults, 0 children for "up to 4")', () => {
    expect(capacityProblem({ baseOccupancy: 2, maxOccupancy: 4, maxAdults: 2, maxChildren: 0 })).toBe('maxOverAdultsAndChildren')
  })

  it('the API refuses the hard problems only', () => {
    expect(hardCapacityProblem({ baseOccupancy: 2, maxOccupancy: 4, maxAdults: 2, maxChildren: 0 })).toBeNull()
    expect(hardCapacityProblem({ ...room, baseOccupancy: 4 })).toBe('baseOverMax')
    expect(hardCapacityProblem({ ...room, maxAdults: 4, maxChildren: 0 })).toBe('adultsOverMax')
  })
})
