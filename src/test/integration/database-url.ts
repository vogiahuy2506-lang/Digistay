/**
 * Integration tests TRUNCATE every table between tests. This guard makes
 * sure they can only ever run against a throwaway database: the database
 * name must end with `_test`, and never with NODE_ENV=production.
 */
export function assertTestDatabaseUrl(
  url: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Integration tests need a throwaway Postgres whose database name ends with "_test" ' +
        '(see CLAUDE.md, "Integration test").'
    )
  }
  if (nodeEnv === 'production') {
    throw new Error('Refusing to run integration tests with NODE_ENV=production.')
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.')
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error(`DATABASE_URL must be a postgres URL, got "${parsed.protocol}".`)
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  if (!/_test$/.test(dbName)) {
    throw new Error(
      `Refusing to run integration tests against database "${dbName}": the name must end with "_test", ` +
        'because every table is truncated between tests.'
    )
  }
  return dbName
}
