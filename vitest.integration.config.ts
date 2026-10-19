import { defineConfig } from 'vitest/config'
import path from 'path'

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
