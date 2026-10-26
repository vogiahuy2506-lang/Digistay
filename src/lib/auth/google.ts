/**
 * Whether "Continue with Google" can work: next-auth registers the provider
 * either way, but without both settings Google sign-in only ever ends on
 * the OAuthSignin error, so the account pages hide the button.
 */
export function googleSignInConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim())
}
