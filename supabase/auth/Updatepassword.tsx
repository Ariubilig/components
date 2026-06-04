import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/**
 * The screen the user lands on from the password-reset email link.
 *
 * Supabase auto-detects the recovery token in the URL and establishes a
 * session (PASSWORD_RECOVERY), so `user` is truthy when this renders.
 * Wire it as a PLAIN route — NOT behind RequireAuth/PostAuthRouter — or the
 * recovery session will get bounced away before the password is updated.
 *
 * No styling — wire up your own CSS.
 */
export default function UpdatePassword() {
  const { user, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // No valid recovery session → direct visit or an expired link.
  if (loading) return <p>Loading…</p>
  if (!user) {
    return (
      <div>
        <h1>Reset password</h1>
        <p>This reset link is invalid or has expired.</p>
        <button type="button" onClick={() => navigate('/auth', { replace: true })}>
          Back to sign in
        </button>
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await updatePassword(password)
      if (error) throw error
      // Success: the user now holds a valid session → drop them into the app.
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>Set a new password</h1>

      <label>
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={6}
          disabled={submitting}
        />
      </label>

      <label>
        Confirm password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          minLength={6}
          disabled={submitting}
        />
      </label>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Please wait…' : 'Update password'}
      </button>
    </form>
  )
}