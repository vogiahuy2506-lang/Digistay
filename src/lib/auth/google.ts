/**
 * Whether "Continue with Google" can work: next-auth registers the provider
 * either way, but without both settings Google sign-in only ever ends on
 * the OAuthSignin error, so the account pages hide the button.
 */
export function googleSignInConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return real(env.GOOGLE_CLIENT_ID) && real(env.GOOGLE_CLIENT_SECRET)
}

/** Set, and not .env.production.template's placeholder (PASTE_… / CHANGE_ME). */
const real = (value: string | undefined) => Boolean(value?.trim()) && !/^(PASTE_|CHANGE_ME)/.test(value!.trim())
