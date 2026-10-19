#!/usr/bin/env node
/**
 * CI guard for prisma/migrations.
 *
 *   node scripts/check-migrations.mjs <base-ref>
 *
 * 1. Append-only: a migration that exists on the base ref must not be
 *    modified, deleted or renamed. It may already be applied in production;
 *    editing it changes nothing there and makes environments drift.
 * 2. Destructive SQL in a NEW migration (DROP, RENAME, TRUNCATE, type
 *    changes, SET NOT NULL, NOT NULL column without default...) needs an
 *    explicit acknowledgement line in the file:
 *
 *      -- destructive-ok: <why this is safe, e.g. column unused since #123>
 *
 * Pure functions are exported for tests; the CLI only wires them to git.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const MIGRATIONS_DIR = 'prisma/migrations/'

const DESTRUCTIVE_PATTERNS = [
  { name: 'DROP TABLE', re: /\bDROP\s+TABLE\b/i },
  { name: 'DROP COLUMN', re: /\bDROP\s+COLUMN\b/i },
  { name: 'DROP TYPE', re: /\bDROP\s+TYPE\b/i },
  { name: 'DROP SCHEMA', re: /\bDROP\s+SCHEMA\b/i },
  { name: 'TRUNCATE', re: /\bTRUNCATE\b/i },
  { name: 'DELETE FROM', re: /\bDELETE\s+FROM\b/i },
  { name: 'RENAME', re: /\bRENAME\s+(TO|COLUMN|CONSTRAINT|VALUE)\b/i },
  { name: 'ALTER COLUMN ... TYPE', re: /\bALTER\s+COLUMN\s+"?[\w]+"?\s+(SET\s+DATA\s+)?TYPE\b/i },
  { name: 'SET NOT NULL', re: /\bSET\s+NOT\s+NULL\b/i },
  {
    name: 'ADD COLUMN ... NOT NULL without DEFAULT',
    re: /\bADD\s+COLUMN\s+(?:(?!\bDEFAULT\b)[^,;])*\bNOT\s+NULL\b(?:(?!\bDEFAULT\b)[^,;])*(?=[,;])/i,
  },
]

// The reason must be on the marker line itself ([ \t], not \s, so an empty
// marker cannot borrow the next SQL line as its "reason").
const ACK_RE = /^--[ \t]*destructive-ok:[ \t]*\S+/m

/** Removes `--` line comments and block comments so they cannot trigger or hide matches. */
export function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

/** Names of destructive operations found in the SQL (comments ignored). */
export function findDestructiveOperations(sql) {
  const code = stripSqlComments(sql)
  return DESTRUCTIVE_PATTERNS.filter(({ re }) => re.test(code)).map(({ name }) => name)
}

export function hasDestructiveAck(sql) {
  return ACK_RE.test(sql)
}

/**
 * Parses `git diff --name-status` output for prisma/migrations.
 * Returns { changedExisting: [{status, path}], added: [path] }.
 */
export function classifyMigrationChanges(nameStatusOutput) {
  const changedExisting = []
  const added = []
  for (const line of nameStatusOutput.split('\n')) {
    if (!line.trim()) continue
    const [status, ...paths] = line.split('\t')
    const touched = paths.filter((p) => p.startsWith(MIGRATIONS_DIR))
    if (touched.length === 0) continue
    if (status === 'A') {
      added.push(...touched)
    } else {
      // M (modified), D (deleted), R### (renamed: old + new), C, T...
      changedExisting.push({ status, path: touched[0] })
    }
  }
  return { changedExisting, added }
}

/** Returns a list of human-readable problems; empty means OK. */
export function checkMigrations({ nameStatusOutput, readFile }) {
  const problems = []
  const { changedExisting, added } = classifyMigrationChanges(nameStatusOutput)

  for (const { status, path } of changedExisting) {
    problems.push(
      `${path}: existing migration changed (git status ${status}). ` +
        'Migrations are append-only — create a new migration instead (npm run db:migrate).'
    )
  }

  for (const path of added.filter((p) => p.endsWith('.sql'))) {
    const sql = readFile(path)
    const ops = findDestructiveOperations(sql)
    if (ops.length > 0 && !hasDestructiveAck(sql)) {
      problems.push(
        `${path}: destructive SQL (${ops.join(', ')}) without acknowledgement. ` +
          'Add a line "-- destructive-ok: <why this is safe>" after checking production data, ' +
          'or split the change (e.g. add nullable column, backfill, then SET NOT NULL).'
      )
    }
  }
  return problems
}

function main() {
  const base = process.argv[2]
  if (!base || /^0+$/.test(base)) {
    console.log('[check-migrations] No base ref (first push of a branch?) — skipping.')
    return
  }
  const nameStatusOutput = execFileSync(
    'git',
    ['diff', '--name-status', '--no-renames', `${base}...HEAD`, '--', MIGRATIONS_DIR],
    { encoding: 'utf8' }
  )
  const problems = checkMigrations({
    nameStatusOutput,
    readFile: (path) => readFileSync(path, 'utf8'),
  })
  if (problems.length > 0) {
    for (const p of problems) console.error(`[check-migrations] ${p}`)
    process.exit(1)
  }
  console.log(`[check-migrations] OK (compared with ${base}).`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
