import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Fees from './pages/Fees'
import Attendance from './pages/Attendance'
import { checkConnection } from './lib/supabase'

type Status = 'checking' | 'ok' | 'error'

export default function App() {
  const [status, setStatus] = useState<Status>('checking')
  const [errMsg, setErrMsg]  = useState('')

  useEffect(() => {
    checkConnection().then(err => {
      if (err) { setErrMsg(err); setStatus('error') }
      else setStatus('ok')
    })
  }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <span className="spinner text-navy-400 w-8 h-8 border-[3px]" />
          <p className="text-sm text-slate-400">Connecting to database…</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 max-w-md w-full">
          {/* Icon */}
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>

          <h2 className="text-base font-bold text-navy-900 mb-1">Database not set up</h2>
          <p className="text-sm text-slate-500 mb-4">
            Could not connect to the database. Run the SQL below in your{' '}
            <a
              href="https://supabase.com/dashboard/project/xzhjdpuzhqjvhgikccjt/sql/new"
              target="_blank"
              rel="noreferrer"
              className="text-navy-600 underline hover:text-navy-800"
            >
              Supabase SQL Editor
            </a>
            , then refresh this page.
          </p>

          {/* Error detail */}
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
            <p className="text-xs font-mono text-red-600 break-words">{errMsg}</p>
          </div>

          {/* SQL snippet */}
          <div className="bg-slate-900 rounded-xl p-3 overflow-x-auto mb-4">
            <pre className="text-xs text-emerald-400 whitespace-pre font-mono leading-relaxed">{SQL_SETUP}</pre>
          </div>

          <button
            onClick={() => { setStatus('checking'); checkConnection().then(e => { if (e) { setErrMsg(e); setStatus('error') } else setStatus('ok') }) }}
            className="btn-primary w-full"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
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
          <Route index element={<Dashboard />} />
          <Route path="students"   element={<Students />} />
          <Route path="fees"       element={<Fees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

const SQL_SETUP = `-- Paste this in Supabase SQL Editor and click Run

CREATE TABLE IF NOT EXISTS batches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  timing     TEXT NOT NULL DEFAULT \'\',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  batch      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status     TEXT NOT NULL DEFAULT \'pending\'
             CHECK (status IN (\'paid\',\'pending\')),
  due_date   DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT \'present\'
             CHECK (status IN (\'present\',\'absent\')),
  CONSTRAINT attendance_student_date_unique UNIQUE (student_id, date)
);

ALTER TABLE batches    DISABLE ROW LEVEL SECURITY;
ALTER TABLE students   DISABLE ROW LEVEL SECURITY;
ALTER TABLE fees       DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;`
