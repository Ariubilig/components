/* AuthProvider.tsx — production-ready, project-agnostic Supabase auth (react-router v6)
 *
 * Exposes: <AuthProvider>, useAuth(), <RequireAuth>, and auth methods
 * (signIn / signUp / signOut / resetPassword / updatePassword).
 *
 * Design rules:
 *  - Provider tracks auth state (session / user / loading) and exposes auth actions.
 *  - onAuthStateChange callback is SYNCHRONOUS — no await, no supabase.* calls
 *    inside it (the documented deadlock trap).
 *  - No navigation in the provider; routing lives in guards and your pages.
 *  - Action methods return Supabase's { error } shape — they never throw.
 *
 * There is intentionally NO app-specific routing here (e.g. "send new users to
 * onboarding"). That belongs in your home route — see README.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import { ROUTES } from './routes'
import type { AuthError, Session, User } from '@supabase/supabase-js'

type Result = { error: AuthError | null }

interface AuthCtx {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<Result>
  signUp: (
    email: string,
    password: string,
  ) => Promise<Result & { needsEmailConfirmation: boolean }>
  signOut: () => Promise<Result>
  resetPassword: (email: string) => Promise<Result>
  updatePassword: (newPassword: string) => Promise<Result>
}

const Ctx = createContext<AuthCtx | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Read whatever is in storage now → resolves `loading` on first paint.
    // The .catch matters: if this promise rejects (corrupt storage, parse
    // error) and we don't handle it, `loading` never flips and the app hangs
    // on the spinner forever.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session)
        setLoading(false)
      })
      .catch((err) => {
        if (!mounted) return
        // No recoverable session — surface the failure and let the app render.
        // Swap console.error for your error sink if you have one.
        console.error('[auth] getSession failed', err)
        setSession(null)
        setLoading(false)
      })

    // Stay in sync. Sync callback only — defer any supabase call with setTimeout(fn, 0).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // All action methods only close over module-level imports (supabase, ROUTES)
  // and stable globals (window), so empty deps give us stable references —
  // which in turn lets the context value memo below stay stable.
  const signIn = useCallback<AuthCtx['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signUp = useCallback<AuthCtx['signUp']>(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    // If email confirmation is ON, no session is returned until the user confirms.
    // NOTE: an already-registered email also returns no session here (Supabase's
    // anti-enumeration behavior), so this flag is not proof of a brand-new account.
    return { error, needsEmailConfirmation: !error && !data.session }
  }, [])

  const signOut = useCallback<AuthCtx['signOut']>(async () => {
    const { error } = await supabase.auth.signOut()
    // No navigate() — SIGNED_OUT fires, the guard redirects.
    return { error }
  }, [])

  // Step 1 of reset: emails a recovery link that lands on the update-password route.
  const resetPassword = useCallback<AuthCtx['resetPassword']>(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${ROUTES.updatePassword}`,
    })
    return { error }
  }, [])

  // Step 2 of reset: call from the update-password screen after the user arrives.
  const updatePassword = useCallback<AuthCtx['updatePassword']>(
    async (newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      return { error }
    },
    [],
  )

  // Memoized so consumers of useAuth() don't re-render when AuthProvider
  // re-renders for unrelated reasons. The methods are stable (above), so this
  // only recomputes when session or loading actually change.
  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [session, loading, signIn, signUp, signOut, resetPassword, updatePassword],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Gate protected routes. Pass your own redirect path / loading fallback. */
export function RequireAuth({
  children,
  redirectTo = ROUTES.login,
  fallback,
}: {
  children: ReactNode
  redirectTo?: string
  fallback?: ReactNode
}) {
  const { user, loading } = useAuth()
  if (loading) return <>{fallback ?? <DefaultSpinner />}</>
  if (!user) return <Navigate to={redirectTo} replace />
  return <>{children}</>
}

function DefaultSpinner() {
  return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>Loading…</div>
}