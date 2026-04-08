import { useCallback, useEffect, useState } from 'react'
import {
  getPendingFees, getFees, addFee, updateFeeStatus,
  getStudents, extractError, type Fee, type Student,
} from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import Toast, { useToast } from '../components/Toast'

const WA_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.029 18.88a7.947 7.947 0 01-4.031-1.086l-.289-.172-2.995.786.8-2.924-.188-.302A7.933 7.933 0 014.07 12.03C4.07 7.624 7.624 4.07 12.03 4.07c2.137 0 4.142.833 5.652 2.344a7.935 7.935 0 012.334 5.638c-.001 4.406-3.555 7.828-7.987 7.828z"/>
  </svg>
)

export default function Fees() {
  const [fees, setFees]         = useState<Fee[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [tab, setTab]           = useState<'pending' | 'all'>('pending')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ student_id: '', amount: '', due_date: '' })
  const { toast, show, hide }   = useToast()

  const load = useCallback(async () => {
    setLoading(true)

    // Use Promise.allSettled so a failing fees query never prevents students
    // from loading — students must always appear in the "Assign Fee" dropdown.
    const [feesResult, studentsResult] = await Promise.allSettled([
      tab === 'pending' ? getPendingFees() : getFees(),
      getStudents(),
    ])

    if (feesResult.status === 'fulfilled') {
      setFees(feesResult.value)
    } else {
      show(`Could not load fees: ${extractError(feesResult.reason)}`, 'error')
      setFees([])
    }

    if (studentsResult.status === 'fulfilled') {
      setStudents(studentsResult.value)
    } else {
      show(`Could not load students: ${extractError(studentsResult.reason)}`, 'error')
      setStudents([])
    }

    setLoading(false)
  }, [tab, show])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!form.student_id || !form.amount || !form.due_date) return
    setSaving(true)
    try {
      await addFee({
        student_id: form.student_id,
        amount: Number(form.amount),
        status: 'pending',
        due_date: form.due_date,
      })
      setForm({ student_id: '', amount: '', due_date: '' })
      setShowForm(false)
      show('Fee assigned successfully')
      await load()
    } catch (e) {
      show(`Failed to assign fee: ${extractError(e)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkPaid = async (fee: Fee) => {
    try {
      await updateFeeStatus(fee.id, 'paid')
      show(`Marked as paid — ${fee.students?.name}`)
      await load()
    } catch (e) {
      show(`Failed to update status: ${extractError(e)}`, 'error')
    }
  }

  const sendReminder = (fee: Fee) => {
    const phone = fee.students?.phone
    if (!phone) return
    const due = new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const msg = encodeURIComponent(
      `Dear ${fee.students?.name},\n\nThis is a reminder that your fee of *₹${fee.amount.toLocaleString('en-IN')}* is due on *${due}*.\n\nKindly make the payment at the earliest to avoid any inconvenience.\n\n— CoachPro Institute Manager`
    )
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank')
  }

  const sendAllReminders = () => {
    const pending = fees.filter(f => f.status === 'pending')
    if (pending.length === 0) return
    pending.forEach((fee, i) => setTimeout(() => sendReminder(fee), i * 700))
    show(`Opening WhatsApp for ${pending.length} student${pending.length > 1 ? 's' : ''}`, 'info')
  }

  const pendingFees    = fees.filter(f => f.status === 'pending')
  const totalPending   = pendingFees.reduce((sum, f) => sum + f.amount, 0)
  const totalCollected = fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0)
  const isOverdue      = (due_date: string) => new Date(due_date) < new Date(new Date().toDateString())

  return (
    <div>
      <PageHeader
        title="Fees"
        subtitle={tab === 'pending' ? `₹${totalPending.toLocaleString('en-IN')} pending` : 'All records'}
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Assign Fee
          </button>
        }
      />

      {/* ── Assign Form ── */}
      {showForm && (
        <div className="card p-4 mb-5">
          <p className="text-sm font-semibold text-navy-900 mb-4">Assign New Fee</p>
          <div className="space-y-3">
            <div>
              <label className="label">Student</label>
              <div className="relative">
                <select
                  className="select"
                  value={form.student_id}
                  onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
                >
                  <option value="">
                    {students.length === 0 ? 'No students yet — add one first' : 'Select student…'}
                  </option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.batch}</option>
                  ))}
                </select>
                <svg className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {students.length === 0 && !loading && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠ No students found. Go to the Students page and add students first.
                </p>
              )}
            </div>
            <div>
              <label className="label">Amount (₹)</label>
              <input
                className="input"
                type="number"
                placeholder="e.g. 2500"
                min="1"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input
                className="input"
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={saving || !form.student_id || !form.amount || !form.due_date}
                className="btn-primary flex-1"
              >
                {saving ? <span className="spinner" /> : 'Assign Fee'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card p-3.5">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Pending</p>
            <p className="text-xl font-bold text-amber-500 mt-1">₹{totalPending.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{pendingFees.length} invoice{pendingFees.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="card p-3.5">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Collected</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">₹{totalCollected.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{fees.filter(f => f.status === 'paid').length} paid</p>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-4">
        {(['pending', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
              tab === t ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'pending' ? `Pending (${pendingFees.length})` : 'All Fees'}
          </button>
        ))}
      </div>

      {/* ── Send All Reminders ── */}
      {tab === 'pending' && pendingFees.length > 0 && (
        <button onClick={sendAllReminders} className="btn-warning w-full mb-4">
          {WA_ICON}
          Send Reminder to All ({pendingFees.length})
        </button>
      )}

      {/* ── Fee List ── */}
      {loading ? (
        <div className="flex justify-center py-12"><span className="spinner text-navy-400" /></div>
      ) : fees.length === 0 ? (
        <EmptyState
          title={tab === 'pending' ? 'No pending fees 🎉' : 'No fee records yet'}
          description="Assign fees to students using the button above."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {fees.map(fee => {
            const overdue = fee.status === 'pending' && isOverdue(fee.due_date)
            return (
              <div key={fee.id} className={`card p-4 ${overdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-navy-100 text-navy-700 font-bold text-sm flex items-center justify-center shrink-0 select-none">
                    {fee.students?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-navy-900">{fee.students?.name}</span>
                      <span className={fee.status === 'paid' ? 'badge-paid' : 'badge-pending'}>
                        {fee.status}
                      </span>
                      {overdue && <span className="badge bg-red-100 text-red-600">overdue</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fee.students?.batch} · Due {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-lg font-bold text-navy-800 mt-1 font-mono">
                      ₹{fee.amount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                {fee.status === 'pending' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button onClick={() => sendReminder(fee)} className="btn-warning flex-1 py-2">
                      {WA_ICON}
                      Remind
                    </button>
                    <button onClick={() => handleMarkPaid(fee)} className="btn-success flex-1 py-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Mark Paid
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
