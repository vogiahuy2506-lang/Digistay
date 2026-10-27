import { describe, it, expect } from 'vitest'
import vi from '../../../../../messages/dash/vi/adminActivity.json'
import { ACTIONS, ENTITIES, VERBS, detailLines } from './labels'

describe('the activity log labels', () => {
  it('has a message for each known action and entity, and no other', () => {
    expect(Object.keys(vi.verbs).sort()).toEqual([...VERBS].sort())
    expect(Object.keys(vi.actions).sort()).toEqual([...ACTIONS].sort())
    expect(Object.keys(vi.entities).sort()).toEqual([...ENTITIES].sort())
  })

  it('never lists an action both as a verb and on its own', () => {
    expect(ACTIONS.filter((a) => (VERBS as readonly string[]).includes(a))).toEqual([])
  })
})

describe('detailLines', () => {
  it('turns an object into key: value lines, nested keys dotted', () => {
    expect(
      detailLines({
        status: 'CHECKED_OUT',
        lateFee: 0,
        paid: true,
        reason: null,
        role: ['ADMIN', 'MANAGER'],
        translations: { en: { name: 'Airport pickup' } },
      })
    ).toEqual([
      { key: 'status', value: 'CHECKED_OUT' },
      { key: 'lateFee', value: '0' },
      { key: 'paid', value: 'true' },
      { key: 'reason', value: 'null' },
      { key: 'role', value: 'ADMIN, MANAGER' },
      { key: 'translations.en.name', value: 'Airport pickup' },
    ])
  })

  it('formats times, and keeps lists of objects and deep values as JSON', () => {
    const lines = detailLines(
      { at: '2026-10-26T14:40:00.000Z', items: [{ id: 1 }], a: { b: { c: { d: { e: 1 } } } }, empty: {} },
      (iso) => `time:${iso.slice(0, 10)}`
    )
    expect(lines).toEqual([
      { key: 'at', value: 'time:2026-10-26' },
      { key: 'items', value: '[{"id":1}]' },
      { key: 'a.b.c.d', value: '{"e":1}' },
      { key: 'empty', value: '{}' },
    ])
  })

  it('gives null for what is not an object (the page shows JSON)', () => {
    expect(detailLines(['a', 'b'])).toBeNull()
    expect(detailLines('text')).toBeNull()
    expect(detailLines(null)).toBeNull()
  })
})
