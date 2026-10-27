/**
 * Shared by the sign-in providers and the login page (client-safe: no
 * server imports). When the password is right but the account has
 * two-factor sign-in, the credentials provider fails with
 * `TWO_FACTOR_REQUIRED:<challenge>`; Google sign-in redirects to
 * `/login?twoFactor=<challenge>`. The login page then asks for the code and
 * signs in with the `two-factor` provider.
 */
export const TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED:'
export const TWO_FACTOR_PROVIDER = 'two-factor'
export const TWO_FACTOR_QUERY = 'twoFactor'

/** /login?error=… after a Google sign-in into an account Digistay locked (User.disabledAt). */
export const ACCOUNT_DISABLED = 'AccountDisabled'
