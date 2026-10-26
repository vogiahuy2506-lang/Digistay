/**
 * A room type's capacity (RoomType: baseOccupancy, maxOccupancy, maxAdults,
 * maxChildren) must hang together, or the hotel site offers a room it then
 * refuses (search checks maxOccupancy, the booking page maxAdults and
 * maxChildren). The room type form checks all of it; the API routes refuse
 * the hard problems only (hardCapacityProblem), so types saved by the old
 * form (2 adults, 0 children, "up to 4") stay editable.
 */
export interface Capacity {
  baseOccupancy: number
  maxOccupancy: number
  maxAdults: number
  maxChildren: number
}

/** What is wrong, or null: the guests priced in the base are within the maximum, and the maximum can be reached. */
export type CapacityProblem = 'baseOverMax' | 'adultsOverMax' | 'maxOverAdultsAndChildren'

export function capacityProblem(c: Capacity): CapacityProblem | null {
  if (c.baseOccupancy > c.maxOccupancy) return 'baseOverMax'
  if (c.maxAdults > c.maxOccupancy) return 'adultsOverMax'
  if (c.maxOccupancy > c.maxAdults + c.maxChildren) return 'maxOverAdultsAndChildren'
  return null
}


/** The problems the API refuses: a maximum below the base guests or the adults. */
export function hardCapacityProblem(c: Capacity): CapacityProblem | null {
  const problem = capacityProblem(c)
  return problem === 'maxOverAdultsAndChildren' ? null : problem
}
