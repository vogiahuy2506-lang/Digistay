/**
 * A member locked because the workspace is over its plan's staff limit
 * (WorkspaceMember.planLockedAt, src/lib/billing/overage.ts) has no access
 * to the workspace. rbac.ts handles it; code that checks membership in its
 * own query must add `planLockedAt: null` next to the userId, or the
 * locked member still gets in. This reads the source, like
 * route-policy.test.ts, so a new query that forgets fails here.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const SRC = path.join(process.cwd(), 'src')

/** Files that read locked memberships on purpose. */
const EXEMPT: Record<string, string> = {
  'src/app/api/workspaces/route.ts': 'lists the workspaces where the caller is locked, to say so',
  'src/lib/auth/rbac.ts': 'getWorkspaceRoleBySlug reads planLockedAt to tell a locked member apart',
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return files(full)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

/** `members: { some|where: { …userId… } }` with a one-line condition. */
const MEMBER_FILTER = /members:\s*\{\s*(?:some|where):\s*\{([^{}\n]*(?:\{[^{}\n]*\}[^{}\n]*)*)\}/g

describe('membership checks', () => {
  it('leave out members locked for being over the plan', () => {
    const missing: string[] = []
    for (const file of files(SRC)) {
      const rel = path.relative(process.cwd(), file).split(path.sep).join('/')
      if (EXEMPT[rel]) continue
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(MEMBER_FILTER)) {
        if (/\buserId\b/.test(m[1]) && !m[1].includes('planLockedAt')) {
          missing.push(`${rel}:${source.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    expect(missing, 'add planLockedAt: null to the membership condition (or list the file in EXEMPT with a reason)').toEqual([])
  })

  it('every exemption still exists', () => {
    for (const rel of Object.keys(EXEMPT)) expect(readFileSync(path.join(process.cwd(), rel), 'utf8')).toContain('members')
  })
})
