import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/StatCard'
import { getStudents, getPendingFees, getTodayAttendance } from '../lib/supabase'

export default function Dashboard() {
  const navigate = useNavigate()

  const [studentCount, setStudentCount] = useState(0)
  const [pendingCount, setPendingCount]   = useState(0)
  const [absentCount, setAbsentCount]     = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [students, pending, attendance] = await Promise.all([
          getStudents(),
          getPendingFees(),
          getTodayAttendance(),
        ])
        setStudentCount(students.length)
        setPendingCount(pending.length)
        setPendingAmount(pending.reduce((sum, f) => sum + f.amount, 0))
        setAbsentCount(attendance.filter((a) => a.status === 'absent').length)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">{today}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Total Students"
          value={studentCount}
          accent="navy"
          loading={loading}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
            </svg>
          }
        />
        <StatCard
          label="Pending Fees"
          value={pendingCount}
          accent="amber"
          loading={loading}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Today Absent"
          value={absentCount}
          accent="red"
          loading={loading}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          }
        />
        <StatCard
          label="Due Amount"
          value={loading ? '—' : `₹${pendingAmount.toLocaleString('en-IN')}`}
          accent="emerald"
          loading={loading}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="card p-4 mb-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => navigate('/fees')} className="btn-primary py-3 flex-col gap-1.5 h-auto">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>View Fees</span>
          </button>
          <button onClick={() => navigate('/attendance')} className="btn-primary py-3 flex-col gap-1.5 h-auto">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Take Attendance</span>
          </button>
          <button onClick={() => navigate('/students')} className="btn-secondary py-3 flex-col gap-1.5 h-auto">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>Add Student</span>
          </button>
          <button onClick={() => navigate('/attendance')} className="btn-secondary py-3 flex-col gap-1.5 h-auto">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>Notify Absent</span>
          </button>
        </div>
      </div>

      {/* Tip */}
      <div className="bg-navy-50 border border-navy-100 rounded-2xl px-4 py-3 flex gap-3">
        <svg className="w-4 h-4 text-navy-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-navy-700 leading-relaxed">
          Start by adding your students, then assign fees and take daily attendance.
        </p>
      </div>
    </div>
  )
}
