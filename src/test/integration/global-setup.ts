/**
 * Vitest globalSetup for integration tests: refuse anything but a *_test
 * database, then build its schema from prisma/migrations — the same files
 * production runs, so there is no separate test schema to drift.
 */
import { execFileSync } from 'node:child_process'
import { assertTestDatabaseUrl } from './database-url'

export default function setup() {
  const dbName = assertTestDatabaseUrl(process.env.DATABASE_URL)
  console.log(`[integration] applying migrations to ${dbName}`)
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  })
}
