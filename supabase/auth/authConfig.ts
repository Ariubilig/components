/* authConfig.ts — auth-related constants & password policy shared across the auth UI.
 *
 * This is a CLIENT-SIDE MIRROR of your Supabase password policy
 * (Dashboard → Authentication → Sign In / Providers → Email → Password
 * Requirements). It exists only to give fast inline feedback before a request
 * is sent — Supabase enforces the real policy server-side. So:
 *
 *  - Keep these values in sync with the dashboard. If the client is laxer than
 *    the server, users hit a confusing rejection after the form "passed"; if
 *    it's stricter, you nag about rules the server doesn't actually enforce.
 *  - Supabase offers PRESET character combinations, not independent toggles.
 *    At time of writing the presets are:
 *      • No required characters (default)
 *      • Lowercase, uppercase letters and digits
 *      • Lowercase, uppercase letters, digits and symbols (recommended)
 *    Set the booleans below to match whichever preset you selected — don't
 *    invent a combination the dashboard can't enforce.
 *  - Existing users can still sign in with a password that predates a policy
 *    change; Supabase only raises a WeakPasswordError at sign-in time. That's
 *    why we validate on sign-UP, not sign-IN (see AuthForm).
 */

export interface PasswordPolicy {
  /** Managed Supabase enforces a floor of 6; the project default is also 6. */
  minLength: number
  requireLowercase: boolean
  requireUppercase: boolean
  requireNumber: boolean
  requireSymbol: boolean
}

/** Edit to match your dashboard. Defaults mirror a fresh Supabase project. */
export const PASSWORD_POLICY: PasswordPolicy = {
  minLength: 6,
  requireLowercase: false,
  requireUppercase: false,
  requireNumber: false,
  requireSymbol: false,
}

/* Characters Supabase counts toward the "symbol" requirement. Space is NOT in
 * the set. Verify against the current docs if you rely on the exact list:
 *   https://supabase.com/docs/guides/auth/password-security */
const SYMBOLS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~'

/**
 * Validate a password against the policy. Returns the first human-readable
 * error, or null if every active rule passes.
 *
 * One message at a time fits the forms' single `error` slot. To show all
 * failures at once, change the return to string[] and push instead of return.
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = PASSWORD_POLICY,
): string | null {
  if (password.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters.`
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter.'
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter.'
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    return 'Password must include a number.'
  }
  if (policy.requireSymbol && ![...password].some((c) => SYMBOLS.includes(c))) {
    return 'Password must include a symbol.'
  }
  return null
}