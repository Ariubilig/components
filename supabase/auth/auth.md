# Supabase Auth Provider

Project-agnostic auth for a **client-side React Router (v6) SPA**, built on `@supabase/supabase-js` v2.

Exposes `<AuthProvider>`, `useAuth()`, `<RequireAuth>`, and the action methods
`signIn` / `signUp` / `signOut` / `resetPassword` / `updatePassword`.

Ships with two unstyled UI components — `AuthForm` (sign in / sign up / request reset)
and `UpdatePassword` (the reset-link landing screen) — plus `routes.ts` and
`authConfig.ts` for app-wide constants.

## Setup

```tsx
// main.tsx — provider wraps the router
<AuthProvider>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</AuthProvider>
```

```tsx
// protect a route
<Route
  path="/dashboard"
  element={
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  }
/>
```

```tsx
// read auth state anywhere
const { user, loading, signIn } = useAuth()
```

## What this provider does / doesn't do

- Tracks `session` / `user` / `loading` and exposes auth actions.
- Does **not** navigate. Redirects live in `<RequireAuth>` and your pages.
- Action methods never throw; they return Supabase's `{ error }` shape.
- App-specific routing (e.g. "send new users to onboarding") belongs in your home route, not here.

## Client prerequisite (`./supabase`)

The recovery and OAuth flows assume the Supabase client was created with `detectSessionInUrl: true`. This is the default — but if you've passed custom `auth` options, keep it on, or the password-recovery link won't establish a session when the user lands on the update-password route.

## Consumer-side gotchas

### `signUp` and already-registered emails

With email confirmation enabled, signing up an email that **already exists** returns a user object with **no session** — indistinguishable from a genuinely new signup. So `needsEmailConfirmation` comes back `true` in both cases. This is Supabase's deliberate anti-enumeration behavior (it won't tell an attacker which emails are registered).

Don't treat that flag as "this is definitely a brand-new account." Show a neutral "check your email to confirm" message either way.

### `resetPassword` redirect must be allowlisted

`resetPassword(email)` sends a recovery link pointing at `ROUTES.updatePassword`. The full URL it constructs — `window.location.origin + ROUTES.updatePassword` — **must** be listed under **Authentication → URL Configuration → Redirect URLs** in the Supabase dashboard.

If it isn't, Supabase silently falls back to the Site URL and the flow breaks. Because the failure is silent, it tends to break **per-environment** (works locally, fails in preview/prod, or vice-versa). Add every origin you deploy to.

### The reset is two steps

- `resetPassword(email)` — **step 1**, sends the email.
- `updatePassword(newPassword)` — **step 2**, call it from the update-password screen *after* the user arrives via the recovery link.

When the user lands via that link, Supabase establishes a temporary recovery session from the URL; `updatePassword` relies on it. Calling `updatePassword` without that session will return an error.

### Test the reset flow in every environment

`UpdatePassword` shows its "invalid or expired link" branch whenever `user` is falsy after `loading` resolves. On a **valid** link this is fine: in supabase-js v2, `getSession()` awaits the client's init, which processes the recovery token in the URL first (both implicit and PKCE flows), so the recovered session is present the moment `loading` flips.

But that correctness depends entirely on the client establishing the recovery session *before* `loading` resolves, and several upstream things can break it per-environment: a mismatched `flowType`, the redirect URL not being allowlisted (see above), or an email template that strips the token. So run the real reset flow in each environment after deploying. If you ever see the invalid-link UI flash on a known-good link, the cause is client/flow config upstream — not this component — and the fix is to gate the invalid branch on an actual `PASSWORD_RECOVERY` auth event instead of `!user`.

### Password rules live in `authConfig.ts`

Client-side validation reads `PASSWORD_POLICY` from `authConfig.ts` and runs through `validatePassword()`. The policy is a small set of toggles:

```ts
export const PASSWORD_POLICY = {
  minLength: 6,
  requireLowercase: false,
  requireUppercase: false,
  requireNumber: false,
  requireSymbol: false,
}
```

This is a **client-side mirror** for fast inline feedback only — Supabase enforces the real policy server-side (Dashboard → Authentication → Sign In / Providers → Email → Password Requirements). Keep it honest:

- **Match the dashboard.** If the client is laxer than the server, the form passes and Supabase then rejects; if it's stricter, you nag about rules the server doesn't have.
- **Supabase uses presets, not free-form toggles.** The dashboard offers "no required characters," "lowercase, uppercase and digits," or "lowercase, uppercase, digits and symbols." Set the booleans to match the preset you picked rather than inventing a combination it can't enforce. The recognized symbol set is documented under [Password security](https://supabase.com/docs/guides/auth/password-security); `authConfig.ts` mirrors it (space excluded).

`validatePassword(pw)` returns the first failing rule as a message, or `null`. `AuthForm` runs it on **sign-up only** — an existing user's password may predate a policy change, so sign-in just submits and lets Supabase raise a `WeakPasswordError` if needed. `UpdatePassword` runs it before calling `updatePassword`. To surface all failures at once instead of the first, switch the return type to `string[]`.

### `getSession()` vs `getUser()` — don't port this to the server as-is

This provider reads `getSession()`, which pulls from local storage and **does not** revalidate the token with the auth server. That's the correct, fast choice for client-side UI gating like `<RequireAuth>`: a tampered local token only ever fools the client's own UI, and your RLS / backend still rejects it.

But if you move auth checks into an **SSR loader, middleware, or server action**, do **not** copy `getSession()` there. Server-side trust decisions must use `getUser()`, which verifies the token with Supabase on every call.

### `AuthForm` does not navigate on success

On successful sign-in — and on sign-up when email confirmation is **off** — `AuthForm` intentionally does nothing visible. It relies on the provider flipping `user`, and on your login route redirecting away once authenticated. If that redirect layer isn't wired, a successful sign-in looks like "nothing happened."

So whatever renders `AuthForm` (typically your login route) must redirect to `ROUTES.root` when `user` becomes truthy — the mirror image of `<RequireAuth>`:

```tsx
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to={ROUTES.root} replace />
  return <>{children}</>
}

// then:
<Route path={ROUTES.login} element={<RedirectIfAuthed><AuthForm /></RedirectIfAuthed>} />
```

Note that `UpdatePassword` must stay on a **plain** route — do not wrap it in `RedirectIfAuthed`, or the recovery session (where `user` is already truthy) gets bounced to `ROUTES.root` before the new password is submitted.

## Implementation notes

- **Synchronous `onAuthStateChange` callback.** No `await`, no `supabase.*` calls inside it — that's a documented deadlock trap. If you need to react with an async call, defer it: `setTimeout(fn, 0)`.
- **`getSession()` has a `.catch`.** A storage/parse failure resolves `loading` (and logs) instead of hanging the app on the spinner forever. Replace the `console.error` with your error sink if you have one.
- **The context value is memoized.** Consumers of `useAuth()` won't re-render when `AuthProvider` re-renders for unrelated reasons; the value only changes when `session` or `loading` actually change.