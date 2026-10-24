/**
 * What the browser tests share: ports, test accounts, and per-run secrets.
 * The secrets are generated once in the Playwright runner and passed on
 * through the environment (workers and the web servers inherit it), so no
 * secret-looking value is ever committed.
 */
import { randomBytes } from 'crypto'

const shared = (name: string, make: () => string) => (process.env[name] ??= make())
const hex = (bytes: number) => () => randomBytes(bytes).toString('hex')

const ports = { app: 3998, payos: 4901, matbao: 4902, smtp: 2526, control: 4910 }

export const E2E = {
  ports,
  baseURL: `http://localhost:${ports.app}`,
  control: `http://127.0.0.1:${ports.control}`,
  cronSecret: shared('E2E_CRON_SECRET', hex(24)),
  /** every test user's password (meets the 8-character rule) */
  password: shared('E2E_USER_PASSWORD', () => `E2e-${randomBytes(6).toString('hex')}`),
  users: {
    admin: { email: 'admin@digistay.vn', username: 'e2eadmin' },
    twoFactor: { email: 'e2e2fa@digistay.test', username: 'e2e2fa' },
    root: { email: 'e2eroot@digistay.test', username: 'e2eroot' },
  },
  payosAccount: {
    clientId: 'e2e-client-0001',
    apiKey: shared('E2E_PAYOS_API_KEY', hex(16)),
    checksumKey: shared('E2E_PAYOS_CHECKSUM_KEY', hex(16)),
  },
  matbaoAccount: {
    taxCode: '0312345678',
    username: 'ks-demo',
    password: shared('E2E_MATBAO_PASSWORD', hex(8)),
  },
  matbaoSeries: `C${String(new Date().getFullYear()).slice(-2)}TAA`,
  /** the one company the fake tax register (e2e/fakes.ts) knows */
  taxCompany: {
    taxCode: '0315550001',
    name: 'CÔNG TY TNHH DU LỊCH HOA SEN',
    address: '12 Lê Lợi, Phường Sài Gòn, TP Hồ Chí Minh',
  },
  idsFile: 'e2e/.state/ids.json',
  adminState: 'e2e/.state/admin.json',
}

export interface E2EIds {
  ws: string
  prop: string
  subdomain: string
  payosBooking: string
  invoiceBooking: string
  autoBooking: string
  /** checked in, due out yesterday: late at any hour */
  lateBooking: string
}
