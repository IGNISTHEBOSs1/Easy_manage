import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getStudents, getPendingFees, getTodayAttendance, getFees,
  getTotalRevenue, getExpenses, computeStudentRisks,
  extractError, type Fee, type StudentRisk,
} from '../lib/supabase'

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, icon, loading, onClick,
}: {
  label: string; value: string | number; sub?: string
  color: 'indigo' | 'amber' | 'red' | 'emerald' | 'violet' | 'cyan'
  icon: React.ReactNode; loading?: boolean; onClick?: () => void
}) {
  const colors = {
    indigo:  { bg: 'bg-indigo-50  dark:bg-indigo-900/20',  icon: 'text-indigo-500',  val: 'text-indigo-600  dark:text-indigo-400' },
    amber:   { bg: 'bg-amber-50   dark:bg-amber-900/20',   icon: 'text-amber-500',   val: 'text-amber-600   dark:text-amber-400' },
    red:     { bg: 'bg-red-50     dark:bg-red-900/20',     icon: 'text-red-500',     val: 'text-red-600     dark:text-red-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-500', val: 'text-emerald-600 dark:text-emerald-400' },
    violet:  { bg: 'bg-violet-50  dark:bg-violet-900/20',  icon: 'text-violet-500',  val: 'text-violet-600  dark:text-violet-400' },
    cyan:    { bg: 'bg-cyan-50    dark:bg-cyan-900/20',    icon: 'text-cyan-500',    val: 'text-cyan-600    dark:text-cyan-400' },
  }
  const c = colors[color]
  return (
    <button
      onClick={onClick}
      className="card p-4 text-left hover:shadow-card-hover active:scale-[0.98] transition-all w-full"
    >
      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
        <span className={c.icon}>{icon}</span>
      </div>
      {loading ? (
        <div className="h-6 w-20 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mb-1" />
      ) : (
        <p className={`text-xl font-bold tracking-tight ${c.val}`}>{value}</p>
      )}
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </button>
  )
}

// ─── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ label }: { label: StudentRisk['risk_label'] }) {
  const styles = {
    'Good':      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    'Warning':   'bg-amber-100   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400',
    'High Risk': 'bg-red-100     dark:bg-red-900/30     text-red-700     dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${styles[label]}`}>
      {label}
    </span>
  )
}

// ─── Insight pill ─────────────────────────────────────────────────────────────
function Insight({ text, type }: { text: string; type: 'info' | 'warn' | 'good' }) {
  const styles = {
    info: 'bg-blue-50  dark:bg-blue-900/20  text-blue-700  dark:text-blue-300  border-blue-200  dark:border-blue-800',
    warn: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    good: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  }
  const icons = {
    info: <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    warn: <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>,
    good: <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  }
  return (
    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${styles[type]}`}>
      {icons[type]}
      <span>{text}</span>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [studentCount,  setStudentCount]  = useState(0)
  const [pendingFees,   setPendingFees]   = useState<Fee[]>([])
  const [allFees,       setAllFees]       = useState<Fee[]>([])
  const [absentCount,   setAbsentCount]   = useState(0)
  const [totalRevenue,  setTotalRevenue]  = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [riskMap,       setRiskMap]       = useState<Map<string, StudentRisk>>(new Map())
  const [students,      setStudents]      = useState<Array<{ id: string; name: string; batch_name_legacy: string; phone: string }>>([])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [studentsRes, pendingRes, allFeesRes, attendanceRes, revenueRes, expensesRes] =
      await Promise.allSettled([
        getStudents(), getPendingFees(), getFees(),
        getTodayAttendance(), getTotalRevenue(), getExpenses(),
      ])

    let sids: string[] = []
    if (studentsRes.status === 'fulfilled') {
      const s = studentsRes.value
      setStudentCount(s.length)
      setStudents(s.map(x => ({ id: x.id, name: x.name, batch_name_legacy: x.batch_name_legacy, phone: x.phone })))
      sids = s.map(x => x.id)
    }
    if (pendingRes.status === 'fulfilled')    setPendingFees(pendingRes.value)
    else setError(extractError(pendingRes.reason))
    if (allFeesRes.status === 'fulfilled')    setAllFees(allFeesRes.value)
    if (attendanceRes.status === 'fulfilled') setAbsentCount(attendanceRes.value.filter(a => a.status === 'absent').length)
    if (revenueRes.status === 'fulfilled')    setTotalRevenue(revenueRes.value)
    if (expensesRes.status === 'fulfilled')   setTotalExpenses(expensesRes.value.reduce((s, e) => s + e.amount, 0))

    if (sids.length > 0) {
      try { setRiskMap(await computeStudentRisks(sids)) } catch { /* non-fatal */ }
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const pendingAmount  = pendingFees.reduce((s, f) => s + f.total_amount, 0)
  const overdueAmount  = pendingFees.filter(f => f.status === 'overdue').reduce((s, f) => s + f.total_amount, 0)
  const netProfit      = totalRevenue - totalExpenses
  const paidFees       = allFees.filter(f => f.status === 'paid').length
  const completionPct  = allFees.length > 0 ? Math.round((paidFees / allFees.length) * 100) : 0
  const overdueFees    = pendingFees.filter(f => f.status === 'overdue' || new Date(f.due_date) < new Date(new Date().toDateString()))
  const dueTodayFees   = pendingFees.filter(f => f.due_date === new Date().toISOString().split('T')[0])

  // ── Top defaulters ──────────────────────────────────────────────────────────
  const topDefaulters = students
    .map(s => ({ ...s, risk: riskMap.get(s.id) }))
    .filter(s => s.risk && s.risk.risk_label !== 'Good' && s.risk.total_pending > 0)
    .sort((a, b) => (b.risk?.risk_score ?? 0) - (a.risk?.risk_score ?? 0))
    .slice(0, 4)

  // ── Risk summary ────────────────────────────────────────────────────────────
  const highRiskCount = [...riskMap.values()].filter(r => r.risk_label === 'High Risk').length
  const warnCount     = [...riskMap.values()].filter(r => r.risk_label === 'Warning').length

  // ── Smart insights ──────────────────────────────────────────────────────────
  const insights: Array<{ text: string; type: 'info' | 'warn' | 'good' }> = []
  if (highRiskCount > 0)
    insights.push({ text: `${highRiskCount} student${highRiskCount > 1 ? 's are' : ' is'} High Risk — follow up on overdue fees`, type: 'warn' })
  if (warnCount > 0)
    insights.push({ text: `${warnCount} student${warnCount > 1 ? 's have' : ' has'} a Warning risk level`, type: 'info' })
  if (overdueFees.length > 0)
    insights.push({ text: `₹${overdueAmount.toLocaleString('en-IN')} overdue across ${overdueFees.length} invoice${overdueFees.length > 1 ? 's' : ''}`, type: 'warn' })
  if (netProfit > 0)
    insights.push({ text: `Net profit this month: ₹${netProfit.toLocaleString('en-IN')}`, type: 'good' })
  if (netProfit < 0)
    insights.push({ text: `Expenses exceed revenue by ₹${Math.abs(netProfit).toLocaleString('en-IN')}`, type: 'warn' })
  if (completionPct >= 80)
    insights.push({ text: `${completionPct}% fee collection rate — excellent!`, type: 'good' })
  if (absentCount > 0)
    insights.push({ text: `${absentCount} student${absentCount > 1 ? 's' : ''} absent today`, type: 'info' })

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Good morning 👋</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{today}</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          <p className="text-xs text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={load} className="text-xs font-semibold text-red-600 underline shrink-0">Retry</button>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Students"   value={studentCount} color="indigo" loading={loading} onClick={() => navigate('/students')}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard label="Total Revenue"    value={loading ? '—' : `₹${totalRevenue.toLocaleString('en-IN')}`} color="emerald" loading={loading} onClick={() => navigate('/fees')}
          sub="All payments collected"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard label="Pending Fees"     value={loading ? '—' : `₹${pendingAmount.toLocaleString('en-IN')}`} color="amber" loading={loading} onClick={() => navigate('/fees')}
          sub={pendingFees.length > 0 ? `${pendingFees.length} invoices` : undefined}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard label="Net Profit"       value={loading ? '—' : `₹${netProfit.toLocaleString('en-IN')}`} color={netProfit >= 0 ? 'emerald' : 'red'} loading={loading} onClick={() => navigate('/expenses')}
          sub="Revenue – Expenses"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        <StatCard label="Total Expenses"   value={loading ? '—' : `₹${totalExpenses.toLocaleString('en-IN')}`} color="red" loading={loading} onClick={() => navigate('/expenses')}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        />
        <StatCard label="Collection Rate"  value={loading ? '—' : `${completionPct}%`} color="violet" loading={loading} onClick={() => navigate('/fees')}
          sub={`${paidFees}/${allFees.length} fees paid`}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* ── Smart Insights ── */}
      {!loading && insights.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Smart Insights</p>
          <div className="space-y-2">
            {insights.map((ins, i) => <Insight key={i} text={ins.text} type={ins.type} />)}
          </div>
        </div>
      )}

      {/* ── Top Defaulters ── */}
      {!loading && topDefaulters.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Top Defaulters</p>
            </div>
            <button onClick={() => navigate('/students')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View all →</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {topDefaulters.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold text-sm flex items-center justify-center shrink-0">
                  {s.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{s.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{s.batch_name_legacy} · ₹{s.risk?.total_pending.toLocaleString('en-IN')} pending</p>
                </div>
                {s.risk && <RiskBadge label={s.risk.risk_label} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Revenue vs Expense summary ── */}
      {!loading && (totalRevenue > 0 || totalExpenses > 0) && (
        <div className="card p-4">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Revenue vs Expenses</p>
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-600 dark:text-slate-400">Revenue</span>
                <span className="font-bold text-emerald-600">₹{totalRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-600 dark:text-slate-400">Expenses</span>
                <span className="font-bold text-red-500">₹{totalExpenses.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full transition-all"
                  style={{ width: totalRevenue > 0 ? `${Math.min((totalExpenses / totalRevenue) * 100, 100)}%` : '100%' }}
                />
              </div>
            </div>
            <div className="pt-1 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Net Profit</span>
              <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {netProfit >= 0 ? '+' : ''}₹{netProfit.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Today's Checklist ── */}
      {!loading && studentCount > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Today's Checklist</p>
          <div className="space-y-2">
            <button onClick={() => navigate('/attendance')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left group">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${absentCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                {absentCount > 0
                  ? <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  : <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Take Today's Attendance</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{absentCount > 0 ? `${absentCount} absent recorded` : 'Mark all students present or absent'}</p>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
            {dueTodayFees.length > 0 && (
              <button onClick={() => navigate('/fees')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left group">
                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Fees Due Today</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{dueTodayFees.length} payment{dueTodayFees.length > 1 ? 's' : ''} due today</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="card p-4">
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Add Student',     to: '/students',  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg> },
            { label: 'Attendance',      to: '/attendance',icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
            { label: 'Assign Fee',      to: '/fees',      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg> },
            { label: 'Add Expense',     to: '/expenses',  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
          ].map((a, i) => (
            <button key={a.to} onClick={() => navigate(a.to)}
              className={`${i < 2 ? 'btn-primary' : 'btn-secondary'} py-3 flex-col gap-1.5 h-auto rounded-xl`}>
              {a.icon}
              <span className="text-xs font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Overdue Fees ── */}
      {!loading && overdueFees.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Overdue Fees</p>
            </div>
            <button onClick={() => navigate('/fees')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View all →</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {overdueFees.slice(0, 4).map(fee => (
              <div key={fee.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm flex items-center justify-center shrink-0">
                  {fee.students?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{fee.students?.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{fee.students?.batch_name_legacy ?? ''} · Due {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">₹{fee.total_amount.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-red-500 font-semibold">OVERDUE</p>
                </div>
              </div>
            ))}
            {overdueFees.length > 4 && (
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700/30">
                <p className="text-xs text-slate-400 text-center">+{overdueFees.length - 4} more overdue</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && studentCount === 0 && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">Welcome to CoachPro!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-xs mx-auto">Start by adding your first student, then assign fees and take attendance every day.</p>
          <button onClick={() => navigate('/students')} className="btn-primary mx-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Your First Student
          </button>
        </div>
      )}
    </div>
  )
}
