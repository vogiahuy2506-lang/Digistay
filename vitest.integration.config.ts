import { defineConfig } from 'vitest/config'
import path from 'path'
import { randomBytes } from 'crypto'

/**
 * Integration tests: real Postgres, real Prisma client, mocked session only.
 *
 * Needs DATABASE_URL pointing at a database whose name ends with `_test`
 * (enforced in src/test/integration/database-url.ts). Files run one at a
 * time because they share that database and truncate it between tests.
 */
export default defineConfig({
  test: {
    globals: true,
    // A fresh key per run (never a committed one): code that stores
    // secrets works in tests without each file setting it up.
    env: { DATA_ENCRYPTION_KEYS: `test:${randomBytes(32).toString('base64')}` },
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    globalSetup: ['./src/test/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
