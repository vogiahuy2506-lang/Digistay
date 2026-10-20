import { defineConfig } from 'vitest/config'
import path from 'path'
import { randomBytes } from 'crypto'

/**
 * Vitest configuration for Digistay.
 *
 * We test pure logic and self-contained helpers here. The default
 * environment is `node`; only flip to `happy-dom` for files that need
 * a DOM (none today, but it's wired so adding component tests is
 * cheap).
 */
export default defineConfig({
  // tsconfig says jsx: "preserve" (Next compiles JSX itself); Vite 8 reads
  // it and cannot parse .tsx tests. Tests compile JSX with the React runtime.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    globals: true,
    // A fresh key per run (never a committed one): code that stores
    // secrets works in tests without each file setting it up.
    env: { DATA_ENCRYPTION_KEYS: `test:${randomBytes(32).toString('base64')}` },
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
    // *.int.test.ts need a real Postgres: run them with `npm run test:int`.
    exclude: ['node_modules', '.next', 'dist', 'src/**/*.int.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts', 'src/lib/**/*.tsx'],
      exclude: [
        'src/lib/db/**',
        'src/lib/email/**',
        'src/lib/hooks/**',
        '**/*.d.ts',
        '**/*.test.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
