import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthProvider'

type Mode = 'signin' | 'signup' | 'reset'

/**
 * Minimal email/password auth form. No styling — wire up your own CSS.
 *
 * On sign-in / confirmed sign-up it does NOT navigate: the provider updates
 * `user`, and your /login route should swap to a redirect (see App.example).
 */
export default function AuthForm() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!email) {
      setError('Email is required.')
      return
    }
    if (mode !== 'reset' && !password) {
      setError('Password is required.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else if (mode === 'signup') {
        const { error, needsEmailConfirmation } = await signUp(email, password)
        if (error) throw error
        if (needsEmailConfirmation) {
          setInfo('Check your email to confirm your account, then sign in.')
          setMode('signin')
        }
      } else {
        const { error } = await resetPassword(email)
        if (error) throw error
        // Neutral message — don't reveal whether the email is registered.
        setInfo('If that email exists, a reset link is on its way.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const title =
    mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'
  const submitLabel =
    mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'

  return (
    <form onSubmit={submit}>
      <h1>{title}</h1>

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={loading}
        />
      </label>

      {mode !== 'reset' && (
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            disabled={loading}
          />
        </label>
      )}

      {error && <p role="alert">{error}</p>}
      {info && <p>{info}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Please wait…' : submitLabel}
      </button>

      {mode === 'signin' && (
        <>
          <button type="button" onClick={() => switchMode('reset')} disabled={loading}>
            Forgot password?
          </button>
          <button type="button" onClick={() => switchMode('signup')} disabled={loading}>
            Need an account? Sign up
          </button>
        </>
      )}

      {mode === 'signup' && (
        <button type="button" onClick={() => switchMode('signin')} disabled={loading}>
          Have an account? Sign in
        </button>
      )}

      {mode === 'reset' && (
        <button type="button" onClick={() => switchMode('signin')} disabled={loading}>
          Back to sign in
        </button>
      )}
    </form>
  )
}