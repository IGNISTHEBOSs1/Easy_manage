import { useState, type FormEvent } from 'react'
import { supabase, extractError } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { AuthShell, Field, ErrorBanner } from './Login'

export default function NoOrg() {
  const { user, logout, error: ctxError, clearError, refreshOrg } = useAuth()
  const [instituteName, setInstituteName] = useState('')
  const [loading,       setLoading]       = useState(false)
  const [localError,    setLocalError]    = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !instituteName.trim()) return
    clearError()
    setLocalError(null)
    setLoading(true)
    try {
      const { error: rpcErr } = await supabase
        .rpc('create_organization_for_user', {
          p_user_id:  user.id,
          p_org_name: instituteName.trim(),
          p_org_slug: instituteName.trim(),
        })
      if (rpcErr) throw rpcErr
      await refreshOrg()
    } catch (e) {
      setLocalError(extractError(e))
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError ?? ctxError

  return (
    <AuthShell title="Almost there" subtitle="Finish setting up your institute">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 -mt-2">
        Your account ({user?.email}) is ready. Enter your institute name to continue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Institute name">
          <input
            type="text" required
            value={instituteName} onChange={e => setInstituteName(e.target.value)}
            className="auth-input"
            placeholder="e.g. Sharma Coaching Classes"
          />
        </Field>

        {displayError && <ErrorBanner message={displayError} />}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <span className="spinner w-4 h-4 mx-auto" /> : 'Set up institute'}
        </button>
      </form>

      <button
        onClick={() => logout()}
        className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        Sign out and use a different account
      </button>
    </AuthShell>
  )
}
