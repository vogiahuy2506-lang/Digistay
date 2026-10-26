/**
 * Browser tests (e2e/), run nightly by .github/workflows/e2e.yml against the
 * production build, with PayOS, Mắt Bão and SMTP faked (e2e/fakes.ts).
 * Locally: docs/RUNBOOK.md, "Kiểm thử trình duyệt (e2e)".
 */
import { defineConfig, devices } from '@playwright/test'
import { randomBytes } from 'crypto'
import { E2E } from './e2e/env'

const appEnv = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  NEXTAUTH_URL: E2E.baseURL,
  NEXT_PUBLIC_SITE_URL: E2E.baseURL,
  NEXTAUTH_SECRET: (process.env.E2E_NEXTAUTH_SECRET ??= randomBytes(32).toString('hex')),
  DATA_ENCRYPTION_KEYS: (process.env.E2E_DATA_KEYS ??= `e2e:${randomBytes(32).toString('base64')}`),
  CRON_SECRET: E2E.cronSecret,
  PAYOS_BASE_URL: `http://127.0.0.1:${E2E.ports.payos}`,
  MATBAO_BASE_URL: `http://127.0.0.1:${E2E.ports.matbao}`,
  TAX_LOOKUP_BASE_URL: E2E.control,
  EMAIL_SERVER_HOST: '127.0.0.1',
  EMAIL_SERVER_PORT: String(E2E.ports.smtp),
  EMAIL_SERVER_USER: 'e2e',
  EMAIL_SERVER_PASSWORD: 'e2e',
  EMAIL_FROM: 'Digistay <noreply@digistay.vn>',
  ALERT_EMAILS: 'ops@digistay.test',
  DIGISTAY_PAYOS_CLIENT_ID: E2E.platformPayos.clientId,
  DIGISTAY_PAYOS_API_KEY: E2E.platformPayos.apiKey,
  DIGISTAY_PAYOS_CHECKSUM_KEY: E2E.platformPayos.checksumKey,
  DIGISTAY_MATBAO_TAX_CODE: E2E.platformMatbao.taxCode,
  DIGISTAY_MATBAO_USERNAME: E2E.platformMatbao.username,
  DIGISTAY_MATBAO_PASSWORD: E2E.platformMatbao.password,
  DIGISTAY_MATBAO_SERIES: E2E.platformMatbaoSeries,
  GOOGLE_CLIENT_ID: 'e2e',
  GOOGLE_CLIENT_SECRET: 'e2e',
  APP_VERSION: process.env.APP_VERSION ?? 'e2e',
  PORT: String(E2E.ports.app),
  HOSTNAME: '127.0.0.1',
  NODE_ENV: 'production',
}

export default defineConfig({
  testDir: './e2e/specs',
  // One shared database and one hotel: run in order, one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: E2E.baseURL,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    viewport: { width: 1366, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 1000 }, storageState: E2E.adminState },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'npx tsx e2e/fakes.ts',
      url: `${E2E.control}/ready`,
      timeout: 60_000,
      stdout: 'pipe',
    },
    {
      // The standalone production build (npm run build && npm run e2e:prepare).
      command: 'node .next/standalone/server.js',
      url: `${E2E.baseURL}/api/health`,
      timeout: 120_000,
      env: appEnv,
    },
  ],
})
