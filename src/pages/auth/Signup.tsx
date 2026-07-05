import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AuthShell, Field, ErrorBanner } from './Login'

export default function Signup() {
  const { signup, error, clearError } = useAuth()

  const [instituteName, setInstituteName] = useState('')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [confirm,       setConfirm]       = useState('')
  const [loading,       setLoading]       = useState(false)
  const [localError,    setLocalError]    = useState<string | null>(null)
  const [done,          setDone]          = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalError(null)

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    if (!instituteName.trim()) {
      setLocalError('Institute name is required.')
      return
    }

    setLoading(true)
    await signup(email.trim(), password, instituteName.trim())
    setLoading(false)
    // If no error after signup, mark done (handles email-confirm flow)
    if (!error) setDone(true)
  }

  if (done && !error) {
    return (
      <AuthShell title="Check your email" subtitle="One last step">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            We sent a confirmation link to <strong className="text-slate-900 dark:text-white">{email}</strong>.
            Click it to activate your account, then log in.
          </p>
          <Link to="/login" className="btn-primary w-full block text-center py-2.5">
            Go to login
          </Link>
        </div>
      </AuthShell>
    )
  }

  const displayError = localError ?? error

  return (
    <AuthShell title="Create your account" subtitle="Set up CoachPro for your institute">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Institute name">
          <input
            type="text" required autoComplete="organization"
            value={instituteName} onChange={e => setInstituteName(e.target.value)}
            className="auth-input"
            placeholder="e.g. Sharma Coaching Classes"
          />
        </Field>

        <Field label="Email">
          <input
            type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            className="auth-input"
            placeholder="you@institute.com"
          />
        </Field>

        <Field label="Password">
          <input
            type="password" required autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)}
            className="auth-input"
            placeholder="Min. 8 characters"
          />
        </Field>

        <Field label="Confirm password">
          <input
            type="password" required autoComplete="new-password"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            className="auth-input"
            placeholder="••••••••"
          />
        </Field>

        {displayError && <ErrorBanner message={displayError} />}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading
            ? <span className="spinner w-4 h-4 mx-auto" />
            : 'Create account'
          }
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-500 hover:text-brand-600">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
