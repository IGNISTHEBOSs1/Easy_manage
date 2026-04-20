import { useCallback, useEffect, useState } from 'react'
import {
  getPendingFees, getFees, addFee, updateFeeStatus,
  getStudents, getBatches, extractError,
  type Fee, type FeeStatus, type Student, type Batch,
} from '../lib/supabase'
import Toast, { useToast } from '../components/Toast'

const WAIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.029 18.88a7.947 7.947 0 01-4.031-1.086l-.289-.172-2.995.786.8-2.924-.188-.302A7.933 7.933 0 014.07 12.03C4.07 7.624 7.624 4.07 12.03 4.07c2.137 0 4.142.833 5.652 2.344a7.935 7.935 0 012.334 5.638c-.001 4.406-3.555 7.828-7.987 7.828z"/>
  </svg>
)

// ─── Status badge helper ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: FeeStatus }) {
  const styles: Record<FeeStatus, string> = {
    paid:    'badge bg-emerald-100 text-emerald-700',
    pending: 'badge bg-amber-100 text-amber-700',
    partial: 'badge bg-blue-100 text-blue-700',
    overdue: 'badge bg-red-100 text-red-700',
  }
  return <span className={styles[status]}>{status}</span>
}

// ─── Bulk WhatsApp Reminder Modal ─────────────────────────────────────────────
interface BulkReminderModalProps {
  fees: Fee[]
  onClose: () => void
  onDone: (count: number) => void
}

function BulkReminderModal({ fees, onClose, onDone }: BulkReminderModalProps) {
  const [index, setIndex] = useState(0)
  const [sent, setSent]   = useState<Set<string>>(new Set())

  const current = fees[index]
  const total   = fees.length
  const allDone = index >= total

  const openWhatsApp = (fee: Fee) => {
    const phone = fee.students?.phone
    if (!phone) return
    const due = new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const msg = encodeURIComponent(
      `Dear ${fee.students?.name},\n\nYour fee of *₹${fee.total_amount.toLocaleString('en-IN')}* is due on *${due}*.\n\nPlease make the payment at the earliest.\n\n— CoachPro Institute`
    )
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank')
    setSent(s => new Set(s).add(fee.id))
  }

  const handleNext = () => {
    if (index + 1 >= total) onDone(sent.size)
    else setIndex(i => i + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Send Fee Reminders</p>
            <p className="text-xs text-slate-400 mt-0.5">{allDone ? 'All done!' : `${index + 1} of ${total}`}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.round((sent.size / total) * 100)}%` }} />
        </div>

        {allDone ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-base font-bold text-slate-800">Reminders Sent!</p>
            <p className="text-sm text-slate-400 mt-1">{sent.size} of {total} reminders sent via WhatsApp</p>
            <button onClick={() => onDone(sent.size)} className="btn-primary mt-5 w-full">Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center shrink-0">
                  {current.students?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{current.students?.name}</p>
                  <p className="text-xs text-slate-400">{current.students?.batch_name_legacy ?? ''} · {current.students?.phone}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-400 mb-1">Message preview</p>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
{`Dear ${current.students?.name},

Your fee of *₹${current.total_amount.toLocaleString('en-IN')}* is due on *${new Date(current.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}*.

Please make the payment at the earliest.

— CoachPro Institute`}
                </p>
              </div>
              {!current.students?.phone && (
                <p className="text-xs text-red-500 mt-2 font-medium">⚠ No phone number — cannot send.</p>
              )}
            </div>

            {sent.has(current.id) && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <p className="text-xs font-semibold">WhatsApp opened for this student</p>
              </div>
            )}

            <div className="flex gap-2">
              {!sent.has(current.id) && current.students?.phone ? (
                <button onClick={() => openWhatsApp(current)} className="btn-warning flex-1 gap-1.5">
                  <WAIcon /> Open WhatsApp
                </button>
              ) : (
                <button onClick={() => openWhatsApp(current)} disabled={!current.students?.phone} className="btn-secondary flex-1 text-xs gap-1.5 opacity-70">
                  <WAIcon /> Re-open
                </button>
              )}
              <button onClick={handleNext} className="btn-primary flex-1">
                {index + 1 >= total ? 'Finish' : 'Next →'}
              </button>
            </div>
            <button onClick={handleNext} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1">
              Skip this student
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Fees Page ───────────────────────────────────────────────────────────

export default function Fees() {
  const [fees,        setFees]        = useState<Fee[]>([])
  const [students,    setStudents]    = useState<Student[]>([])
  const [batches,     setBatches]     = useState<Batch[]>([])
  const [tab,         setTab]         = useState<'pending' | 'all'>('pending')
  const [showForm,    setShowForm]    = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [payingIds,   setPayingIds]   = useState<Set<string>>(new Set())
  const [filterBatch, setFilterBatch] = useState<string>('all')
  const [showBulk,    setShowBulk]    = useState(false)
  const [form, setForm] = useState({ student_id: '', amount: '', due_date: '' })
  const { toast, show, hide } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const [feesRes, studentsRes, batchesRes] = await Promise.allSettled([
      tab === 'pending' ? getPendingFees() : getFees(),
      getStudents(),
      getBatches(),
    ])
    if (feesRes.status === 'fulfilled')     setFees(feesRes.value)
    else show(`Fees error: ${extractError(feesRes.reason)}`, 'error')
    if (studentsRes.status === 'fulfilled') setStudents(studentsRes.value)
    if (batchesRes.status === 'fulfilled')  setBatches(batchesRes.value)
    setLoading(false)
  }, [tab, show])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!form.student_id || !form.amount || !form.due_date) return
    setSaving(true)
    try {
      await addFee({ student_id: form.student_id, total_amount: Number(form.amount), due_date: form.due_date })
      setForm({ student_id: '', amount: '', due_date: '' })
      setShowForm(false)
      show('Fee assigned ✓')
      await load()
    } catch (e) { show(`Failed: ${extractError(e)}`, 'error') }
    finally { setSaving(false) }
  }

  const handleMarkPaid = async (fee: Fee) => {
    if (payingIds.has(fee.id)) return
    setPayingIds(s => new Set(s).add(fee.id))
    try {
      await updateFeeStatus(fee.id, 'paid')
      show(`Marked paid — ${fee.students?.name}`)
      await load()
    } catch (e) { show(`Failed: ${extractError(e)}`, 'error') }
    finally { setPayingIds(s => { const n = new Set(s); n.delete(fee.id); return n }) }
  }

  const sendReminder = (fee: Fee) => {
    const phone = fee.students?.phone
    if (!phone) { show('No phone number for this student', 'error'); return }
    const due = new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const msg = encodeURIComponent(
      `Dear ${fee.students?.name},\n\nYour fee of *₹${fee.total_amount.toLocaleString('en-IN')}* is due on *${due}*.\n\nPlease make the payment at the earliest.\n\n— CoachPro Institute`
    )
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank')
  }

  // Status includes partial and overdue now
  const pendingFees    = fees.filter(f => f.status === 'pending' || f.status === 'partial' || f.status === 'overdue')
  const totalPending   = pendingFees.reduce((s, f) => s + f.total_amount, 0)
  const totalCollected = fees.filter(f => f.status === 'paid').reduce((s, f) => s + f.total_amount, 0)
  const isOverdue      = (d: string) => new Date(d) < new Date(new Date().toDateString())

  const visibleFees = filterBatch === 'all' ? fees : fees.filter(f => {
    const s = students.find(st => st.id === f.student_id)
    return s?.batch_id === filterBatch
  })
  const visiblePending = visibleFees.filter(f => f.status !== 'paid')

  return (
    <div className="space-y-5">

      {showBulk && (
        <BulkReminderModal
          fees={visiblePending}
          onClose={() => setShowBulk(false)}
          onDone={(count) => { setShowBulk(false); show(`${count} reminder${count !== 1 ? 's' : ''} sent via WhatsApp`, 'info') }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fees</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? '…' : `₹${totalPending.toLocaleString('en-IN')} pending · ₹${totalCollected.toLocaleString('en-IN')} collected`}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Assign Fee
        </button>
      </div>

      {/* ── Assign Fee Form ── */}
      {showForm && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-800">Assign New Fee</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {students.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No students found. Add students first.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Student</label>
                <div className="relative">
                  <select className="select" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                    <option value="">Select student…</option>
                    {batches.map(b => {
                      const bStudents = students.filter(s => s.batch_id === b.id)
                      if (!bStudents.length) return null
                      return (
                        <optgroup key={b.id} label={`${b.name}${b.timing ? ` (${b.timing})` : ''}`}>
                          {bStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </optgroup>
                      )
                    })}
                    {students.filter(s => !batches.find(b => b.id === s.batch_id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name} — {s.batch_name_legacy}</option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount (₹)</label>
                  <input className="input" type="number" placeholder="2500" min="1" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input className="input" type="date" value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving || !form.student_id || !form.amount || !form.due_date} className="btn-primary flex-1">
                  {saving ? <span className="spinner" /> : 'Assign Fee'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Summary ── */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold text-amber-500 mt-1 tracking-tight">₹{totalPending.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{pendingFees.length} invoice{pendingFees.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Collected</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1 tracking-tight">₹{totalCollected.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{fees.filter(f => f.status === 'paid').length} paid</p>
          </div>
        </div>
      )}

      {/* ── Tabs + Batch Filter ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex bg-slate-200 rounded-xl p-1 w-full sm:w-auto">
          {(['pending', 'all'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 sm:w-28 py-2 text-xs font-bold rounded-lg transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              {t === 'pending' ? `Pending (${pendingFees.length})` : 'All Fees'}
            </button>
          ))}
        </div>
        {batches.length > 0 && (
          <div className="relative flex-1 sm:max-w-44">
            <select className="select text-xs py-2" value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
              <option value="all">All Batches</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <svg className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        )}
      </div>

      {/* ── Bulk Reminder Button ── */}
      {tab === 'pending' && visiblePending.length > 0 && (
        <button onClick={() => setShowBulk(true)} className="btn-warning w-full">
          <WAIcon /> Send Reminder to All Pending ({visiblePending.length})
        </button>
      )}

      {/* ── Fee List ── */}
      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-brand-400" /></div>
      ) : visibleFees.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-sm font-bold text-slate-700">{tab === 'pending' ? 'No pending fees 🎉' : 'No fee records yet'}</p>
          <p className="text-xs text-slate-400 mt-1">
            {tab === 'pending' ? 'All fees have been collected!' : 'Use "Assign Fee" to add your first fee record.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleFees.map(fee => {
            const overdue  = fee.status === 'overdue' || (fee.status !== 'paid' && isOverdue(fee.due_date))
            const isPaying = payingIds.has(fee.id)
            return (
              <div key={fee.id} className={`card p-4 ${overdue ? 'border-red-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 select-none ${overdue ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'}`}>
                    {fee.students?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">{fee.students?.name}</span>
                      <StatusBadge status={fee.status} />
                      {overdue && fee.status !== 'overdue' && <span className="badge bg-red-100 text-red-600">overdue</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fee.students?.batch_name_legacy ?? ''} · Due {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xl font-bold text-slate-800 mt-1.5 font-mono tracking-tight">
                      ₹{fee.total_amount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                {fee.status !== 'paid' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button onClick={() => sendReminder(fee)} className="btn-warning flex-1 py-2 text-xs gap-1">
                      <WAIcon /> Remind
                    </button>
                    <button onClick={() => handleMarkPaid(fee)} disabled={isPaying} className="btn-success flex-1 py-2 text-xs">
                      {isPaying
                        ? <span className="spinner w-3.5 h-3.5" />
                        : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Mark Paid</>
                      }
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
