import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login, error, clearError, status } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLoading(true)
    await login(email.trim(), password)
    setLoading(false)
    // navigation handled by ProtectedRoute once status becomes 'authenticated'
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to CoachPro">
      <form onSubmit={handleSubmit} className="space-y-4">
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
            type="password" required autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            className="auth-input"
            placeholder="••••••••"
          />
          <div className="text-right mt-1">
            <Link to="/forgot-password" className="text-xs text-brand-500 hover:text-brand-600 dark:hover:text-brand-400">
              Forgot password?
            </Link>
          </div>
        </Field>

        {error && <ErrorBanner message={error} />}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <span className="spinner w-4 h-4 mx-auto" /> : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        No account?{' '}
        <Link to="/signup" className="font-medium text-brand-500 hover:text-brand-600">
          Create one free
        </Link>
      </p>
    </AuthShell>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

export function AuthShell({
  title, subtitle, children,
}: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-900 dark:text-white leading-none">CoachPro</p>
            <p className="text-[10px] font-medium tracking-widest uppercase text-slate-400 mt-0.5">Institute Manager</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200 dark:border-slate-700 p-6">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-0.5">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3.5 py-2.5 flex gap-2.5 items-start">
      <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p className="text-xs text-red-700 dark:text-red-400">{message}</p>
    </div>
  )
}

// Tailwind class used across auth pages — add to index.css instead of repeating
// .auth-input is defined in index.css
