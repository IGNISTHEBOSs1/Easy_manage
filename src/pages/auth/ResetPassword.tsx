import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AuthShell, Field, ErrorBanner } from './Login'

// ── Forgot Password (step 1: enter email) ────────────────────────────────────

export function ForgotPassword() {
  const { resetPassword, error, clearError } = useAuth()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLoading(true)
    const ok = await resetPassword(email.trim())
    setLoading(false)
    if (ok) setSent(true)
  }

  if (sent && !error) {
    return (
      <AuthShell title="Email sent" subtitle="Check your inbox">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            We sent a reset link to <strong className="text-slate-900 dark:text-white">{email}</strong>.
            Check your spam folder if it doesn't arrive in a minute.
          </p>
          <Link to="/login" className="btn-secondary w-full block text-center py-2.5">
            Back to login
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a reset link">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <input
            type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            className="auth-input"
            placeholder="you@institute.com"
          />
        </Field>

        {error && <ErrorBanner message={error} />}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <span className="spinner w-4 h-4 mx-auto" /> : 'Send reset link'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link to="/login" className="font-medium text-brand-500 hover:text-brand-600">
          ← Back to login
        </Link>
      </p>
    </AuthShell>
  )
}

// ── Reset Password (step 2: set new password, arrived via email link) ─────────

export function ResetPassword() {
  const { updatePassword, error, clearError, status } = useAuth()
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [loading,  setLoading]    = useState(false)
  const [done,     setDone]       = useState(false)
  const [localErr, setLocalErr]   = useState<string | null>(null)

  // Fix 3: guard against direct navigation with no session.
  // PASSWORD_RECOVERY event sets status to 'authenticated' in AuthContext.
  // Any other status here means the link is expired or was never clicked.
  if (status === 'initialising') {
    return (
      <AuthShell title="Set new password" subtitle="Checking your reset link…">
        <div className="flex justify-center py-4">
          <span className="spinner text-brand-500" />
        </div>
      </AuthShell>
    )
  }

  if (status !== 'authenticated') {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is no longer valid">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Password reset links expire after 1 hour. Request a new one to continue.
          </p>
          <Link to="/forgot-password" className="btn-primary w-full block text-center py-2.5">
            Request new link
          </Link>
        </div>
      </AuthShell>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalErr(null)

    if (password.length < 8) { setLocalErr('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setLocalErr('Passwords do not match.'); return }

    setLoading(true)
    const ok = await updatePassword(password)
    setLoading(false)
    if (ok) setDone(true)
  }

  if (done && !error) {
    return (
      <AuthShell title="Password updated" subtitle="You're all set">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your password has been updated. Log in with your new password.
          </p>
          <Link to="/login" className="btn-primary w-full block text-center py-2.5">
            Go to login
          </Link>
        </div>
      </AuthShell>
    )
  }

  const displayError = localErr ?? error

  return (
    <AuthShell title="Set new password" subtitle="Choose a strong password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New password">
          <input
            type="password" required autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)}
            className="auth-input"
            placeholder="Min. 8 characters"
          />
        </Field>

        <Field label="Confirm new password">
          <input
            type="password" required autoComplete="new-password"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            className="auth-input"
            placeholder="••••••••"
          />
        </Field>

        {displayError && <ErrorBanner message={displayError} />}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <span className="spinner w-4 h-4 mx-auto" /> : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}
