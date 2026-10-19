import { describe, it, expect } from 'vitest'
import { assertTestDatabaseUrl } from './database-url'

describe('assertTestDatabaseUrl', () => {
  it('accepts a database whose name ends with _test', () => {
    expect(assertTestDatabaseUrl('postgresql://u:p@localhost:5432/digistay_test?schema=public', 'test')).toBe(
      'digistay_test'
    )
  })

  it.each([
    ['production-like name', 'postgresql://u:p@postgres:5432/digistay?schema=public'],
    ['_test in the middle only', 'postgresql://u:p@localhost:5432/digistay_test_backup'],
    ['_test only in the user name', 'postgresql://digistay_test:p@localhost:5432/digistay'],
    ['not postgres', 'mysql://u:p@localhost:3306/digistay_test'],
  ])('refuses %s', (_label, url) => {
    expect(() => assertTestDatabaseUrl(url, 'test')).toThrow()
  })

  it('refuses a missing URL', () => {
    expect(() => assertTestDatabaseUrl(undefined, 'test')).toThrow(/DATABASE_URL is not set/)
  })

  it('refuses NODE_ENV=production even with a _test database', () => {
    expect(() => assertTestDatabaseUrl('postgresql://u:p@localhost:5432/digistay_test', 'production')).toThrow(
      /production/
    )
  })
})
