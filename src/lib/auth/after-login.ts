/**
 * Where the login page sends someone once signed in: ?callbackUrl= when it
 * is a path of this site (an invitation link, say), else the workspaces.
 * Never another site: "//evil.example" and "/\evil.example" are refused.
 */
export function afterLogin(raw: string | null | undefined): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/workspaces'
}
