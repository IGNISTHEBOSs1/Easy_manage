import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Fees from './pages/Fees'
import Attendance from './pages/Attendance'
import Expenses from './pages/Expenses'
import { checkConnection } from './lib/supabase'
import { useTheme } from './hooks/useTheme'

const SQL_SETUP = `-- Paste this in Supabase SQL Editor and click Run

CREATE TABLE IF NOT EXISTS batches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  timing     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  batch_id          UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  batch_name_legacy TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  organization_id UUID,
  total_amount    NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('paid','pending','partial','overdue')),
  due_date        DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id          UUID NOT NULL REFERENCES fees(id) ON DELETE RESTRICT,
  organization_id UUID,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  method          TEXT NOT NULL DEFAULT 'cash',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'present'
             CHECK (status IN ('present','absent')),
  CONSTRAINT attendance_student_date_unique UNIQUE (student_id, date)
);

CREATE TABLE IF NOT EXISTS expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category   TEXT NOT NULL DEFAULT 'other',
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE batches    DISABLE ROW LEVEL SECURITY;
ALTER TABLE students   DISABLE ROW LEVEL SECURITY;
ALTER TABLE fees       DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments   DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses   DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;`

// Apply stored theme on initial load before React renders
const storedTheme = localStorage.getItem('coachpro-theme')
if (storedTheme === 'dark') document.documentElement.classList.add('dark')
else document.documentElement.classList.remove('dark')

function AppContent() {
  // Keep theme hook active so toggle works across the app
  useTheme()

  const [connError, setConnError] = useState<string | null>(null)
  const [checking,  setChecking]  = useState(true)
  const [copied,    setCopied]    = useState(false)

  useEffect(() => {
    checkConnection().then(err => {
      setConnError(err)
      setChecking(false)
    })
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SETUP).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="spinner text-brand-500" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Connecting to CoachPro…</p>
        </div>
      </div>
    )
  }

  if (connError) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200 dark:border-slate-700 max-w-lg w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Database Setup Required</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Could not connect: {connError}</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Run this SQL in your Supabase project's SQL Editor to create the required tables:
          </p>
          <div className="relative">
            <pre className="text-xs bg-slate-950 text-slate-300 rounded-xl p-4 overflow-auto max-h-64 font-mono leading-relaxed">{SQL_SETUP}</pre>
            <button onClick={handleCopy}
              className="absolute top-2 right-2 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => window.location.reload()}
            className="mt-4 w-full btn-primary">
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index         element={<Dashboard />} />
          <Route path="students"   element={<Students />} />
          <Route path="fees"       element={<Fees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="expenses"   element={<Expenses />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return <AppContent />
}
