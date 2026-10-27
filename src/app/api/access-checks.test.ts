/**
 * Who may do what is decided by permissions (src/lib/auth/permissions.ts),
 * checked through src/lib/auth/access.ts on the server and useCan() in the
 * dashboard. A role is only a preset and a job title: code that tests one
 * (`role === 'ADMIN'`, `role: { in: [...] }`, `.includes(m.role)`) would skip
 * a member's own ticked permissions and their properties. This reads the
 * source, like route-policy.test.ts, so such a check fails here.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const SRC = path.join(process.cwd(), 'src')

/** Files that name roles on purpose. */
const EXEMPT: Record<string, string> = {
  'src/lib/auth/permissions.ts': 'the role presets themselves',
  'src/lib/auth/access.ts': 'the checks themselves: a preset member has what their role has',
  'src/app/(dashboard)/profile/page.tsx': "the user's platform role (User.role: SUPER_ADMIN), not a workspace's",
}

const ROLE_CHECKS = [
  /\brole\s*[!=]==?\s*'(ADMIN|MANAGER|RECEPTIONIST|USER)'/,
  /\brole:\s*\{\s*in\b/,
  /\.includes\(\s*\w+\.role\s*\)/,
  /\bWorkspaceRoles\./,
]

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return name === 'test' ? [] : files(full)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

describe('access checks', () => {
  it('go by permission, not by role', () => {
    const found: string[] = []
    for (const file of files(SRC)) {
      const rel = path.relative(process.cwd(), file).split(path.sep).join('/')
      if (EXEMPT[rel]) continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (ROLE_CHECKS.some((re) => re.test(line))) found.push(`${rel}:${i + 1}: ${line.trim()}`)
        })
    }
    expect(found, 'check a permission (access.ts can / requireAccess, useCan) instead of a role').toEqual([])
  })
})
