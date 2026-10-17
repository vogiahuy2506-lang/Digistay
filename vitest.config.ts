import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest configuration for Digistay.
 *
 * We test pure logic and self-contained helpers here. The default
 * environment is `node`; only flip to `happy-dom` for files that need
 * a DOM (none today, but it's wired so adding component tests is
 * cheap).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
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
