/**
 * Route policy: every API handler must either call an auth helper or be
 * listed in PUBLIC_HANDLERS below with a reason.
 *
 * middleware.ts skips /api, so nothing guards an API route but the route
 * itself. Two of the worst bugs found in 2026-10 were handlers that were
 * public by accident (an unauthenticated PUT that marked payments PAID, a
 * password reset that needed only an email). This test makes "public" a
 * reviewed decision: a new handler without auth fails CI until someone
 * adds auth or lists it here with a reason.
 *
 * Limits: it checks that an auth helper is *called*, not that the result
 * is used correctly (workspace scoping, roles); those still need review
 * and their own tests (see tenant-isolation.int.test.ts).
 *
 * Exports it cannot read (wrappers, re-exports, destructuring, `export *`)
 * fail too: an unreadable handler is treated as unauthenticated.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import ts from 'typescript'

const API_DIR = path.join(__dirname)
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
const AUTH_HELPERS = new Set(['auth', 'getServerSession', 'requireSession', 'requireWorkspaceRole'])

/** Reviewed public handlers. Key: "METHOD /api/path". Keep the reason specific. */
const PUBLIC_HANDLERS: Record<string, string> = {
  'GET /api/auth/[...nextauth]': 'next-auth endpoints (session, csrf, providers); sign-in is guarded inside next-auth',
  'POST /api/auth/[...nextauth]':
    'next-auth sign-in/sign-out; password limits in src/lib/auth/credentials.ts, two-factor step in two-factor-login.ts',
  'POST /api/auth/otp/send': 'sends signup/forgot-password codes; per-IP + per-email limits, same answer for unknown emails',
  'POST /api/auth/otp/verify': 'checks forgot-password codes; 5 tries per code, per-IP failure limit',
  'POST /api/auth/register': 'sign-up and signup-code check; per-IP limits',
  'POST /api/auth/resend-verification': 'resends the signup code; per-IP limit, same answer for unknown emails',
  'POST /api/auth/reset-password': 'requires the single-use reset token issued by otp/verify',
  'GET /api/bookings/availability': 'room availability for the public booking site',
  'POST /api/bookings/room-lock': 'guests hold a room while booking; per-IP limit',
  'DELETE /api/bookings/room-lock': "guests release their own hold by the lock/session id they were given",
  'GET /api/health': 'deploy and uptime checks; returns only status and image version',
  'GET /api/internal/custom-domains':
    'certificate queue for docker/certbot/custom-domains.sh: checkCronSecret, and nginx does not route /api/internal/',
  'POST /api/internal/custom-domains':
    'certificate outcome from docker/certbot/custom-domains.sh: checkCronSecret, and nginx does not route /api/internal/',
  'GET /api/public/site-host':
    "which site a verified custom domain serves, for the middleware; public like visiting the domain itself",
  'POST /api/internal/email-outbox':
    'scheduled job: checkCronSecret (CRON_SECRET header, timing-safe), and nginx does not route /api/internal/',
  'POST /api/internal/einvoice-jobs':
    'scheduled job: checkCronSecret (CRON_SECRET header, timing-safe), and nginx does not route /api/internal/',
  'POST /api/internal/ops-alerts':
    'scheduled job: checkCronSecret (CRON_SECRET header, timing-safe), and nginx does not route /api/internal/',
  'POST /api/internal/payos-reconcile':
    'scheduled job: checkCronSecret (CRON_SECRET header, timing-safe), and nginx does not route /api/internal/',
  'POST /api/internal/purge-deleted':
    'scheduled job (purge after 30 days): checkCronSecret (CRON_SECRET header, timing-safe), and nginx does not route /api/internal/',
  'POST /api/internal/subscription-jobs':
    'scheduled job (plan reminders): checkCronSecret (CRON_SECRET header, timing-safe), and nginx does not route /api/internal/',
  'POST /api/internal/platform-payos/confirm-webhook':
    "one-off setup of Digistay's PayOS webhook (RUNBOOK): checkCronSecret, and nginx does not route /api/internal/",
  'GET /api/invitations/[token]': 'invitation preview; the unguessable token in the URL is the credential',
  'POST /api/public/bookings':
    'guests book on the hotel site: rate-limited per IP and per email, PENDING, never a payment (create-booking.ts)',
  'POST /api/public/contact': 'contact form on the marketing site; emails the Digistay team only, per-IP limit',
  'GET /api/public/deposits/[token]': 'the deposit page polls where its deposit stands; the token is the credential, per-IP limit',
  'POST /api/public/deposits/[token]':
    'a guest pays their deposit again: the HMAC token is the credential (deposit-link.ts), rate-limited per IP; only a PayOS link, never marks anything paid',
  'GET /api/public/tax-lookup':
    'company name and address for a tax code, for invoice fields (public tax register via VietQR); per-IP limit, nothing stored',
  'POST /api/payments/webhook': 'disabled: always 404; gateways use /api/webhooks/<gateway>/...',
  'POST /api/webhooks/matbao/[propertyId]/[token]':
    'Mắt Bão tax-office status; the per-property secret token in the URL is the credential (unsigned callbacks); per-IP limit',
  'POST /api/webhooks/payos/[propertyId]':
    "PayOS notifications; the HMAC signature, checked with that property's checksum key, is the credential; per-IP limit",
  'POST /api/webhooks/payos/digistay':
    "PayOS notifications for plan payments on Digistay's own account; the HMAC signature (Digistay's checksum key) is the credential; per-IP limit",
  'GET /api/properties/public': 'public property site (name, address, contact, rooms)',
}

interface Handler {
  key: string
  /** null when the export is not a function we can read (e.g. `export { handler as GET }`). */
  callsAuth: boolean | null
}

/** Every extension Next serves a route handler from (pageExtensions default + modules). */
const ROUTE_FILE = /^route\.(ts|tsx|js|jsx|mts|mjs)$/

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(full)
    return ROUTE_FILE.test(entry.name) ? [full] : []
  })
}

function callsAuthHelper(node: ts.Node): boolean {
  let found = false
  const visit = (n: ts.Node) => {
    if (found) return
    if (ts.isCallExpression(n)) {
      const callee = n.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null
      if (name && AUTH_HELPERS.has(name)) found = true
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

const isExported = (node: ts.Node) =>
  ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

/** Names bound by `const { GET, POST: { x } } = ...` or `const [GET] = ...`. */
function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((element) => (ts.isBindingElement(element) ? boundNames(element.name) : []))
}

function handlersIn(file: string): Handler[] {
  const dir = path.dirname(path.relative(API_DIR, file)).split(path.sep).join('/')
  const route = dir === '.' ? '/api' : `/api/${dir}`
  return handlersInSource(route, file, fs.readFileSync(file, 'utf8'))
}

function handlersInSource(route: string, fileName: string, text: string): Handler[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
  const found: Handler[] = []
  const add = (method: string, callsAuth: boolean | null) => found.push({ key: `${method} ${route}`, callsAuth })

  for (const stmt of source.statements) {
    // export async function GET() {}
    if (ts.isFunctionDeclaration(stmt) && stmt.name && isExported(stmt) && HTTP_METHODS.has(stmt.name.text)) {
      add(stmt.name.text, stmt.body ? callsAuthHelper(stmt.body) : null)
    }
    // export const GET = async () => {}  /  export const GET = withSomething(...)
    if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        // export const { GET, POST } = handlers
        if (!ts.isIdentifier(decl.name)) {
          for (const name of boundNames(decl.name)) if (HTTP_METHODS.has(name)) add(name, null)
          continue
        }
        if (!HTTP_METHODS.has(decl.name.text)) continue
        const init = decl.initializer
        const readable = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        add(decl.name.text, readable ? callsAuthHelper(init) : null)
      }
    }
    // export { handler as GET, handler as POST }
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const spec of stmt.exportClause.elements) {
        if (HTTP_METHODS.has(spec.name.text)) add(spec.name.text, null)
      }
    }
    // export * from './handlers': could export any method
    if (ts.isExportDeclaration(stmt) && !stmt.exportClause && !stmt.isTypeOnly) {
      add('*', null)
    }
  }
  return found
}

const handlers = routeFiles(API_DIR).flatMap(handlersIn)
const byKey = new Map(handlers.map((h) => [h.key, h]))

describe('route policy analyzer', () => {
  const read = (text: string) => handlersInSource('/api/x', 'route.ts', text)

  it('reads plain handlers and whether they call auth', () => {
    expect(read('export async function GET() { await auth() }\nexport const POST = async () => 1')).toEqual([
      { key: 'GET /api/x', callsAuth: true },
      { key: 'POST /api/x', callsAuth: false },
    ])
  })

  it('reports exports it cannot read instead of skipping them', () => {
    expect(read('export const { GET, POST } = handlers')).toEqual([
      { key: 'GET /api/x', callsAuth: null },
      { key: 'POST /api/x', callsAuth: null },
    ])
    expect(read("export * from './handlers'")).toEqual([{ key: '* /api/x', callsAuth: null }])
    expect(read("export { handler as DELETE } from './handlers'")).toEqual([{ key: 'DELETE /api/x', callsAuth: null }])
  })

  it('finds route files with every extension Next serves', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-policy-'))
    try {
      for (const name of ['route.ts', 'route.tsx', 'route.js', 'route.jsx', 'route.mjs', 'page.tsx', 'route.test.ts']) {
        fs.mkdirSync(path.join(dir, name.replace(/\W/g, '-')))
        fs.writeFileSync(path.join(dir, name.replace(/\W/g, '-'), name), '')
      }
      expect(routeFiles(dir).map((file) => path.basename(file)).sort()).toEqual([
        'route.js',
        'route.jsx',
        'route.mjs',
        'route.ts',
        'route.tsx',
      ])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('API route policy', () => {
  it('finds the API handlers (sanity check)', () => {
    expect(handlers.length).toBeGreaterThan(50)
  })

  it('every handler calls an auth helper or is a reviewed public handler', () => {
    const unreviewed = handlers
      .filter((h) => h.callsAuth !== true && !(h.key in PUBLIC_HANDLERS))
      .map((h) => (h.callsAuth === null ? `${h.key} (export not analyzable)` : h.key))
    expect(
      unreviewed,
      'Add an auth check (auth()/requireSession()/requireWorkspaceRole()) or, if the handler must be public, ' +
        'list it in PUBLIC_HANDLERS in src/app/api/route-policy.test.ts with a specific reason.'
    ).toEqual([])
  })

  it('the public list has no stale entries', () => {
    const missing = Object.keys(PUBLIC_HANDLERS).filter((key) => !byKey.has(key))
    expect(missing, 'Remove entries for handlers that no longer exist').toEqual([])
  })

  it('handlers that now check auth are taken off the public list', () => {
    const nowAuthed = Object.keys(PUBLIC_HANDLERS).filter((key) => byKey.get(key)?.callsAuth === true)
    expect(nowAuthed, 'These handlers call an auth helper; remove them from PUBLIC_HANDLERS').toEqual([])
  })

  it('every public entry has a real reason', () => {
    const vague = Object.entries(PUBLIC_HANDLERS).filter(([, reason]) => reason.trim().length < 20)
    expect(vague).toEqual([])
  })
})
