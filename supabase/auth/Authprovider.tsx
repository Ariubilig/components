/* AuthProvider.tsx — production-ready Supabase auth for a React SPA (react-router v6)
 *
 * Reusable across projects: <AuthProvider>, useAuth(), <RequireAuth>, and the
 * auth methods (signIn / signUp / signOut / resetPassword / updatePassword).
 * App-specific (bottom of file): <PostAuthRouter> — your /plan vs /questions logic.
 *
 * Design rules:
 *  - Provider tracks auth state (session / user / loading) and exposes auth actions.
 *  - onAuthStateChange callback is SYNCHRONOUS — no await, no supabase.* calls
 *    inside it (the documented deadlock trap).
 *  - No navigation in the provider; routing lives in guards.
 *  - Action methods return Supabase's { error } shape — they never throw — so
 *    callers can branch simply. Per-action loading is the caller's concern.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { AuthError, Session, User } from '@supabase/supabase-js'

/* ============================ REUSABLE CORE ============================ */

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
  signOut: () => Promise<void>
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
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
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

  /* ---- Auth actions (centralized so components never import supabase) ---- */

  const signIn: AuthCtx['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp: AuthCtx['signUp'] = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    // If email confirmation is ON, no session is returned until the user confirms.
    return { error, needsEmailConfirmation: !error && !data.session }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    // No navigate() — SIGNED_OUT fires, the guard redirects.
  }

  // Step 1 of reset: emails a recovery link that lands on /update-password.
  const resetPassword: AuthCtx['resetPassword'] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    return { error }
  }

  // Step 2 of reset: call from /update-password after the user arrives via the link.
  const updatePassword: AuthCtx['updatePassword'] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

/** Gate protected routes. Reusable: pass your own redirect path / loader. */
export function RequireAuth({
  children,
  redirectTo = '/auth',
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

/* ========================== APP-SPECIFIC ==========================
 * Not reusable — queries `user_profiles` and decides /plan vs /questions.
 * For cross-project reuse, lift this into its own file; everything above
 * drops into any app unchanged.
 */
export function PostAuthRouter() {
  const { user, loading } = useAuth()
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false

    supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setTarget(data && !error ? '/plan' : '/questions')
      })

    return () => {
      cancelled = true
    }
  }, [loading, user])

  if (loading) return <DefaultSpinner />
  if (!user) return <Navigate to="/auth" replace />
  if (!target) return <DefaultSpinner />
  return <Navigate to={target} replace />
}