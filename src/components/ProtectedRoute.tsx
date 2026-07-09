import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NoOrg from '../pages/auth/NoOrg'

// Renders children only when status === 'authenticated' AND org is present.
// All other states redirect or render the appropriate recovery screen.

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const location   = useLocation()

  console.log('[PROTECTED] rendering with status:', status, '| path:', location.pathname)

  if (status === 'initialising') {
    // Identical to the existing "Connecting to CoachPro…" spinner in App.tsx
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="spinner text-brand-500" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (status === 'no_org') {
    return <NoOrg />
  }

  // status === 'authenticated'
  return <>{children}</>
}
