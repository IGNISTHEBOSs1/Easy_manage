import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/StatCard'
import { getStudents, getPendingFees, getTodayAttendance, extractError, type Fee } from '../lib/supabase'

export default function Dashboard() {
  const navigate = useNavigate()

  const [studentCount,  setStudentCount]  = useState(0)
  const [pendingFees,   setPendingFees]   = useState<Fee[]>([])
  const [absentCount,   setAbsentCount]   = useState(0)
  const [totalStudents, setTotalStudents] = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [studentsRes, feesRes, attendanceRes] = await Promise.allSettled([
      getStudents(),
      getPendingFees(),
      getTodayAttendance(),
    ])
    if (studentsRes.status === 'fulfilled') {
      setStudentCount(studentsRes.value.length)
      setTotalStudents(studentsRes.value.length)
    }
    if (feesRes.status === 'fulfilled') setPendingFees(feesRes.value)
    else setError(extractError(feesRes.reason))
    if (attendanceRes.status === 'fulfilled')
      setAbsentCount(attendanceRes.value.filter(a => a.status === 'absent').length)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const pendingAmount = pendingFees.reduce((s, f) => s + f.amount, 0)
  const isToday = (d: string) => d === new Date().toISOString().split('T')[0]

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const overdueFees = pendingFees.filter(f => new Date(f.due_date) < new Date(new Date().toDateString()))
  const dueTodayFees = pendingFees.filter(f => isToday(f.due_date))

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Good morning 👋</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today}</p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-red-700 flex-1">{error}</p>
          <button onClick={load} className="text-xs font-semibold text-red-600 underline shrink-0">Retry</button>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Students"
          value={studentCount}
          color="indigo"
          loading={loading}
          onClick={() => navigate('/students')}
          icon={
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="Pending Fees"
          value={loading ? '—' : `₹${pendingAmount.toLocaleString('en-IN')}`}
          color="amber"
          loading={loading}
          onClick={() => navigate('/fees')}
          hint={pendingFees.length > 0 ? `${pendingFees.length} invoices` : undefined}
          icon={
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Absent Today"
          value={absentCount}
          color="red"
          loading={loading}
          onClick={() => navigate('/attendance')}
          hint={absentCount > 0 ? 'Action needed' : undefined}
          icon={
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
        <StatCard
          label="Overdue Fees"
          value={overdueFees.length}
          color="emerald"
          loading={loading}
          onClick={() => navigate('/fees')}
          hint={overdueFees.length > 0 ? 'Overdue' : 'All clear'}
          icon={
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* ── Today's Checklist ── */}
      {!loading && totalStudents > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Today's Checklist</p>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/attendance')}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                absentCount > 0 ? 'bg-amber-100' : 'bg-emerald-100'
              }`}>
                {absentCount > 0
                  ? <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  : <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">Take Today's Attendance</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {absentCount > 0 ? `${absentCount} absent recorded` : 'Mark all students present or absent'}
                </p>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>

            {dueTodayFees.length > 0 && (
              <button
                onClick={() => navigate('/fees')}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Fees Due Today</p>
                  <p className="text-xs text-slate-400 mt-0.5">{dueTodayFees.length} payment{dueTodayFees.length > 1 ? 's' : ''} due today</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="card p-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => navigate('/students')} className="btn-primary py-3 flex-col gap-1.5 h-auto rounded-xl">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="text-xs font-semibold">Add Student</span>
          </button>
          <button onClick={() => navigate('/attendance')} className="btn-primary py-3 flex-col gap-1.5 h-auto rounded-xl">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="text-xs font-semibold">Take Attendance</span>
          </button>
          <button onClick={() => navigate('/fees')} className="btn-secondary py-3 flex-col gap-1.5 h-auto rounded-xl">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-semibold">Assign Fee</span>
          </button>
          <button onClick={() => navigate('/fees')} className="btn-secondary py-3 flex-col gap-1.5 h-auto rounded-xl">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
            <span className="text-xs font-semibold">Send Reminders</span>
          </button>
        </div>
      </div>

      {/* ── Overdue Fees List ── */}
      {!loading && overdueFees.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-sm font-bold text-slate-800">Overdue Fees</p>
            </div>
            <button onClick={() => navigate('/fees')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View all →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {overdueFees.slice(0, 4).map(fee => (
              <div key={fee.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-sm flex items-center justify-center shrink-0">
                  {fee.students?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{fee.students?.name}</p>
                  <p className="text-xs text-slate-400">{fee.students?.batch} · Due {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-800">₹{fee.amount.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-red-500 font-semibold">OVERDUE</p>
                </div>
              </div>
            ))}
            {overdueFees.length > 4 && (
              <div className="px-4 py-2.5 bg-slate-50">
                <p className="text-xs text-slate-400 text-center">+{overdueFees.length - 4} more overdue</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state when no students ── */}
      {!loading && totalStudents === 0 && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Welcome to CoachPro!</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
            Start by adding your first student. Then assign fees and take attendance every day.
          </p>
          <button onClick={() => navigate('/students')} className="btn-primary mx-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Student
          </button>
        </div>
      )}
    </div>
  )
}
