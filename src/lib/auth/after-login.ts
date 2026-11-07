/**
 * Where the login page sends someone once signed in: ?callbackUrl= when it
 * is a path of this site (an invitation link, say), else the workspaces (or /admin for superadmin).
 * Never another site: "//evil.example" and "/\evil.example" are refused.
 */
export function afterLogin(raw: string | null | undefined, role?: string): string {
  const isSafePath = raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')
  if (isSafePath && raw !== '/workspaces') {
    return raw
  }
  return role === 'SUPER_ADMIN' ? '/admin' : '/workspaces'
}

