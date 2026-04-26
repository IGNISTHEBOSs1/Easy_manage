import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPendingFees, getFees, addFee,
  recordPayment, applyLateFee, bulkApplyLateFees,
  generateRecurringFees, getFeeBalance,
  getStudents, getBatches, extractError,
  type Fee, type FeeBalance, type FeeStatus,
  type PaymentMethod, type Student, type Batch,
} from '../lib/supabase'
import Toast, { useToast } from '../components/Toast'

// ─── jsPDF invoice (CDN, loaded on first click — no npm install) ──────────────
async function generateInvoicePDF(fee: Fee, balance: FeeBalance | null): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).jspdf) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load jsPDF'))
    document.head.appendChild(s)
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = (window as any).jspdf
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const baseAmount   = Number(balance?.total_amount   ?? fee.total_amount)
  const lateFee      = Number(balance?.late_fee_amount ?? 0)
  const totalPayable = baseAmount + lateFee
  const paid         = Number(balance?.total_paid      ?? 0)
  const balanceDue   = Number(balance?.balance_due     ?? baseAmount)
  const status       = ((balance?.effective_status ?? fee.status) as string).toUpperCase()
  const studentName  = fee.students?.name              ?? '—'
  const batch        = fee.students?.batch_name_legacy ?? '—'
  const dueDate      = new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const generatedAt  = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const L = 20, R = 190
  let y = 20

  doc.setFillColor(67, 56, 202)
  doc.rect(0, 0, 210, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('CoachPro', L, 9)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text('Fee Invoice', R, 9, { align: 'right' })

  y = 24
  doc.setTextColor(15, 23, 42); doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', L, y)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
  y += 5; doc.text(`Generated: ${generatedAt}`, L, y)

  const sc: [number, number, number] = status === 'PAID' ? [22, 163, 74] : status === 'OVERDUE' ? [220, 38, 38] : [245, 158, 11]
  doc.setFillColor(...sc)
  doc.roundedRect(R - 28, y - 5, 28, 7, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
  doc.text(status, R - 14, y, { align: 'center' })

  y += 8; doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(L, y, R, y)

  y += 8; doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
  doc.text('BILLED TO', L, y)
  y += 5; doc.setTextColor(15, 23, 42); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text(studentName, L, y)
  y += 5; doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105)
  doc.text(`Batch: ${batch}`, L, y)
  y += 4; doc.text(`Due Date: ${dueDate}`, L, y)

  y += 10; doc.setFillColor(241, 245, 249); doc.rect(L, y, 170, 7, 'F')
  doc.setTextColor(71, 85, 105); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
  doc.text('DESCRIPTION', L + 3, y + 4.5); doc.text('AMOUNT', R - 3, y + 4.5, { align: 'right' })

  const row = (label: string, value: number, bold = false, color: [number, number, number] = [15, 23, 42]) => {
    y += 8; doc.setFontSize(9); doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...color)
    doc.text(label, L + 3, y)
    doc.text(`Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, R - 3, y, { align: 'right' })
  }

  row('Base Fee Amount', baseAmount)
  if (lateFee > 0) row('Late Fee Penalty', lateFee, false, [220, 38, 38])
  y += 2; doc.setDrawColor(226, 232, 240); doc.line(L, y, R, y)
  row('Total Payable', totalPayable, true)
  row('Amount Paid', paid, false, [22, 163, 74])
  y += 2; doc.setFillColor(239, 246, 255); doc.rect(L, y, 170, 9, 'F')
  y += 6; doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(67, 56, 202)
  doc.text('Balance Due', L + 3, y)
  doc.text(`Rs. ${balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, R - 3, y, { align: 'right' })
  y += 16; doc.setDrawColor(226, 232, 240); doc.line(L, y, R, y)
  y += 5; doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184)
  doc.text('CoachPro Institute Manager  •  This is a computer-generated invoice.', 105, y, { align: 'center' })

  doc.save(`Invoice_${studentName.replace(/\s+/g, '_')}_${fee.due_date}.pdf`)
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const WAIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.029 18.88a7.947 7.947 0 01-4.031-1.086l-.289-.172-2.995.786.8-2.924-.188-.302A7.933 7.933 0 014.07 12.03C4.07 7.624 7.624 4.07 12.03 4.07c2.137 0 4.142.833 5.652 2.344a7.935 7.935 0 012.334 5.638c-.001 4.406-3.555 7.828-7.987 7.828z"/>
  </svg>
)

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: FeeStatus }) {
  const styles: Record<FeeStatus, string> = {
    paid:    'badge bg-emerald-100 text-emerald-700',
    pending: 'badge bg-amber-100 text-amber-700',
    partial: 'badge bg-blue-100 text-blue-700',
    overdue: 'badge bg-red-100 text-red-700',
  }
  return <span className={styles[status]}>{status}</span>
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────
interface PayModalProps {
  fee:     Fee
  balance: FeeBalance | null
  onClose: () => void
  onDone:  () => void
  show:    (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

function PayModal({ fee, balance, onClose, onDone, show }: PayModalProps) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const balanceDue = Number(balance?.balance_due ?? fee.total_amount)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handlePay = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) { show('Enter a valid amount', 'error'); return }
    if (amt > balanceDue)  { show(`Cannot exceed balance of ₹${balanceDue.toLocaleString('en-IN')}`, 'error'); return }
    setSaving(true)
    try {
      await recordPayment(fee.id, amt, method, notes || undefined)
      show(`Payment of ₹${amt.toLocaleString('en-IN')} recorded ✓`)
      onDone()
    } catch (e) { show(extractError(e), 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Record Payment</p>
            <p className="text-xs text-slate-400 mt-0.5">{fee.students?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">₹{(Number(balance?.total_amount ?? fee.total_amount) + Number(balance?.late_fee_amount ?? 0)).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Paid</p>
              <p className="text-sm font-bold text-emerald-600 mt-0.5">₹{Number(balance?.total_paid ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Balance</p>
              <p className="text-sm font-bold text-red-600 mt-0.5">₹{balanceDue.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div>
            <label className="label">Amount Paying (₹)</label>
            <input ref={inputRef} className="input" type="number"
              placeholder={`Max ₹${balanceDue.toLocaleString('en-IN')}`} min="1" max={balanceDue}
              value={amount} onChange={e => setAmount(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setAmount(String(balanceDue))} className="text-xs text-brand-600 hover:text-brand-700 font-semibold">
                Pay full ₹{balanceDue.toLocaleString('en-IN')}
              </button>
              {balanceDue > 0 && (
                <button onClick={() => setAmount(String(Math.floor(balanceDue / 2)))} className="text-xs text-slate-400 hover:text-slate-600">Half</button>
              )}
            </div>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <div className="relative">
              <select className="select" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
              <svg className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input className="input" placeholder="e.g. April instalment" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handlePay} disabled={saving || !amount || Number(amount) <= 0} className="btn-primary flex-1">
              {saving ? <><span className="spinner w-4 h-4" /> Processing…</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Record Payment</>}
            </button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bulk WhatsApp Reminder Modal ─────────────────────────────────────────────
interface BulkReminderModalProps { fees: Fee[]; onClose: () => void; onDone: (count: number) => void }

function BulkReminderModal({ fees, onClose, onDone }: BulkReminderModalProps) {
  const [index, setIndex] = useState(0)
  const [sent,  setSent]  = useState<Set<string>>(new Set())
  const current = fees[index], total = fees.length, allDone = index >= total

  const openWA = (fee: Fee) => {
    const phone = fee.students?.phone; if (!phone) return
    const due = new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const msg = encodeURIComponent(`Dear ${fee.students?.name},\n\nYour fee of *₹${fee.total_amount.toLocaleString('en-IN')}* is due on *${due}*.\n\nPlease make the payment at the earliest.\n\n— CoachPro Institute`)
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank')
    setSent(s => new Set(s).add(fee.id))
  }
  const next = () => { if (index + 1 >= total) onDone(sent.size); else setIndex(i => i + 1) }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div><p className="text-sm font-bold text-slate-800">Send Fee Reminders</p>
               <p className="text-xs text-slate-400 mt-0.5">{allDone ? 'All done!' : `${index + 1} of ${total}`}</p></div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="h-1 bg-slate-100"><div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.round((sent.size / total) * 100)}%` }} /></div>
        {allDone ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-base font-bold text-slate-800">Reminders Sent!</p>
            <p className="text-sm text-slate-400 mt-1">{sent.size} of {total} sent via WhatsApp</p>
            <button onClick={() => onDone(sent.size)} className="btn-primary mt-5 w-full">Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center shrink-0">{current.students?.name?.[0]?.toUpperCase() ?? '?'}</div>
                <div><p className="text-sm font-bold text-slate-800">{current.students?.name}</p>
                     <p className="text-xs text-slate-400">{current.students?.batch_name_legacy ?? ''} · {current.students?.phone}</p></div>
              </div>
              <p className="text-xs text-slate-600 bg-white rounded-lg border border-slate-200 p-3 leading-relaxed whitespace-pre-wrap">
{`Dear ${current.students?.name},\n\nYour fee of *₹${current.total_amount.toLocaleString('en-IN')}* is due on *${new Date(current.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}*.\n\nPlease make the payment at the earliest.\n\n— CoachPro Institute`}
              </p>
              {!current.students?.phone && <p className="text-xs text-red-500 mt-2 font-medium">⚠ No phone number — cannot send.</p>}
            </div>
            {sent.has(current.id) && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <p className="text-xs font-semibold">WhatsApp opened</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => openWA(current)} disabled={!current.students?.phone} className="btn-warning flex-1 gap-1.5">
                <WAIcon /> {sent.has(current.id) ? 'Re-send' : 'Open WhatsApp'}
              </button>
              <button onClick={next} className="btn-primary flex-1">{index + 1 >= total ? 'Finish' : 'Next →'}</button>
            </div>
            <button onClick={next} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1">Skip</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Generate Recurring Fees Modal ────────────────────────────────────────────
interface GenerateModalProps { onClose: () => void; onDone: () => void; show: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void }

function GenerateModal({ onClose, onDone, show }: GenerateModalProps) {
  const now = new Date()
  const [year, setYear]     = useState(now.getFullYear())
  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [running, setRunning] = useState(false)
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const handleGenerate = async () => {
    setRunning(true)
    try {
      const results = await generateRecurringFees(year, month)
      const created = results.reduce((s, r) => s + (r.fees_created ?? 0), 0)
      const skipped = results.reduce((s, r) => s + (r.fees_skipped ?? 0), 0)
      if (results.length === 0) show('No active recurring rules found', 'warning')
      else show(`Generated ${created} fee${created !== 1 ? 's' : ''} · ${skipped} skipped (already exist)`, 'success')
      onDone()
    } catch (e) { show(extractError(e), 'error') }
    finally { setRunning(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div><p className="text-sm font-bold text-slate-800">Generate Monthly Fees</p>
               <p className="text-xs text-slate-400 mt-0.5">Creates fees for all active recurring rules</p></div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Month</label>
              <div className="relative">
                <select className="select" value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <svg className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div>
              <label className="label">Year</label>
              <input className="input" type="number" min={2024} max={2030} value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">This is <strong>idempotent</strong> — safe to run multiple times. Existing fees will be skipped.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleGenerate} disabled={running} className="btn-primary flex-1">
              {running ? <><span className="spinner w-4 h-4" /> Generating…</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Generate Fees</>}
            </button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Balance breakdown row (shown on expand) ──────────────────────────────────
function FeeBalanceRow({ balance, loading }: { balance: FeeBalance | null; loading: boolean }) {
  if (loading) return <div className="flex items-center gap-2 px-1 py-1.5"><span className="spinner w-3.5 h-3.5 text-slate-300" /><span className="text-xs text-slate-400">Loading balance…</span></div>
  if (!balance) return null
  const { total_amount, total_paid, late_fee_amount, balance_due } = balance
  const displayTotal = Number(total_amount) + Number(late_fee_amount)
  return (
    <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-xl p-3 text-center">
      {[
        { label: 'Total',    val: displayTotal,            cls: 'text-slate-700' },
        { label: 'Paid',     val: Number(total_paid),      cls: 'text-emerald-600' },
        { label: 'Late Fee', val: Number(late_fee_amount), cls: 'text-orange-500' },
        { label: 'Balance',  val: Number(balance_due),     cls: Number(balance_due) > 0 ? 'text-red-600' : 'text-emerald-600' },
      ].map(({ label, val, cls }) => (
        <div key={label}>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</p>
          <p className={`text-xs font-bold mt-0.5 ${cls}`}>₹{val.toLocaleString('en-IN')}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main Fees Page ───────────────────────────────────────────────────────────
export default function Fees() {
  const [fees,         setFees]         = useState<Fee[]>([])
  const [students,     setStudents]     = useState<Student[]>([])
  const [batches,      setBatches]      = useState<Batch[]>([])
  const [tab,          setTab]          = useState<'pending' | 'all'>('pending')
  const [showForm,     setShowForm]     = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [filterBatch,  setFilterBatch]  = useState<string>('all')
  const [showBulk,     setShowBulk]     = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [bulkLate,     setBulkLate]     = useState(false)

  const [payingFee,      setPayingFee]      = useState<Fee | null>(null)
  const [busyIds,        setBusyIds]        = useState<Set<string>>(new Set())
  const [balances,       setBalances]       = useState<Record<string, FeeBalance>>({})
  const [balanceLoading, setBalanceLoading] = useState<Set<string>>(new Set())
  const [expandedIds,    setExpandedIds]    = useState<Set<string>>(new Set())

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

  const loadBalance = useCallback(async (feeId: string) => {
    if (balances[feeId] || balanceLoading.has(feeId)) return
    setBalanceLoading(s => new Set(s).add(feeId))
    try {
      const bal = await getFeeBalance(feeId)
      setBalances(b => ({ ...b, [feeId]: bal }))
    } catch { /* silently ignore */ }
    finally { setBalanceLoading(s => { const n = new Set(s); n.delete(feeId); return n }) }
  }, [balances, balanceLoading])

  const toggleExpand = (feeId: string) => {
    setExpandedIds(s => {
      const n = new Set(s)
      if (n.has(feeId)) n.delete(feeId)
      else { n.add(feeId); loadBalance(feeId) }
      return n
    })
  }

  // Correct display total = base + late fee
  const getDisplayTotal = (fee: Fee) => {
    const bal = balances[fee.id]
    return bal ? Number(bal.total_amount) + Number(bal.late_fee_amount) : fee.total_amount
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!form.student_id || !form.amount || !form.due_date) return
    setSaving(true)
    try {
      await addFee({ student_id: form.student_id, total_amount: Number(form.amount), due_date: form.due_date })
      setForm({ student_id: '', amount: '', due_date: '' })
      setShowForm(false)
      show('Fee assigned ✓')
      await load()
    } catch (e) { show(extractError(e), 'error') }
    finally { setSaving(false) }
  }

  const handleQuickPayFull = async (fee: Fee) => {
    if (busyIds.has(fee.id)) return
    const bal = balances[fee.id]
    const balanceDue = bal ? Number(bal.balance_due) : fee.total_amount
    if (balanceDue <= 0) { show('This fee is already fully paid', 'info'); return }
    setBusyIds(s => new Set(s).add(fee.id))
    try {
      await recordPayment(fee.id, balanceDue, 'cash')
      setFees(prev => prev.map(f => f.id === fee.id ? { ...f, status: 'paid' as FeeStatus } : f))
      setBalances(b => { const n = { ...b }; delete n[fee.id]; return n })
      show(`Full payment of ₹${balanceDue.toLocaleString('en-IN')} recorded ✓`)
      load()
    } catch (e) { show(extractError(e), 'error') }
    finally { setBusyIds(s => { const n = new Set(s); n.delete(fee.id); return n }) }
  }

  const handleApplyLateFee = async (fee: Fee) => {
    if (busyIds.has(fee.id)) return
    setBusyIds(s => new Set(s).add(fee.id))
    try {
      const result = await applyLateFee(fee.id)
      if (result.was_applied) {
        show(`Late fee of ₹${Number(result.late_fee_amount).toLocaleString('en-IN')} applied ✓`)
        setFees(prev => prev.map(f => f.id === fee.id ? { ...f, status: 'overdue' as FeeStatus } : f))
        setBalances(b => { const n = { ...b }; delete n[fee.id]; return n })
        load()
      } else {
        show(result.reason ?? 'Late fee not applicable', 'info')
      }
    } catch (e) { show(extractError(e), 'error') }
    finally { setBusyIds(s => { const n = new Set(s); n.delete(fee.id); return n }) }
  }

  const handleBulkLateFees = async () => {
    setBulkLate(true)
    try {
      const result = await bulkApplyLateFees()
      show(`Applied ${result.applied} late fee${result.applied !== 1 ? 's' : ''} · ${result.skipped} skipped`, 'info')
      setBalances({})
      await load()
    } catch (e) { show(extractError(e), 'error') }
    finally { setBulkLate(false) }
  }

  const sendReminder = (fee: Fee) => {
    const phone = fee.students?.phone
    if (!phone) { show('No phone number for this student', 'error'); return }
    const due = new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const msg = encodeURIComponent(`Dear ${fee.students?.name},\n\nYour fee of *₹${fee.total_amount.toLocaleString('en-IN')}* is due on *${due}*.\n\nPlease make the payment at the earliest.\n\n— CoachPro Institute`)
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank')
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const pendingFees    = fees.filter(f => f.status !== 'paid')
  const totalPending   = pendingFees.reduce((s, f) => s + f.total_amount, 0)
  const totalCollected = fees.filter(f => f.status === 'paid').reduce((s, f) => s + f.total_amount, 0)
  const visibleFees    = filterBatch === 'all' ? fees : fees.filter(f => students.find(st => st.id === f.student_id)?.batch_id === filterBatch)
  const visiblePending = visibleFees.filter(f => f.status !== 'paid')

  return (
    <div className="space-y-5">

      {/* Modals */}
      {payingFee && (
        <PayModal
          fee={payingFee}
          balance={balances[payingFee.id] ?? null}
          onClose={() => setPayingFee(null)}
          onDone={() => {
            setPayingFee(null)
            setBalances(b => { const n = { ...b }; delete n[payingFee.id]; return n })
            load()
          }}
          show={show}
        />
      )}
      {showBulk && (
        <BulkReminderModal
          fees={visiblePending}
          onClose={() => setShowBulk(false)}
          onDone={(count) => { setShowBulk(false); show(`${count} reminder${count !== 1 ? 's' : ''} sent via WhatsApp`, 'info') }}
        />
      )}
      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onDone={async () => { setShowGenerate(false); await load() }}
          show={show}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fees</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? '…' : `₹${totalPending.toLocaleString('en-IN')} pending · ₹${totalCollected.toLocaleString('en-IN')} collected`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowGenerate(true)} className="btn-secondary text-xs py-2 px-3 gap-1.5" title="Generate monthly recurring fees">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <span className="hidden sm:inline">Monthly</span>
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Assign Fee
          </button>
        </div>
      </div>

      {/* Assign Fee Form */}
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
                      const bs = students.filter(s => s.batch_id === b.id)
                      if (!bs.length) return null
                      return <optgroup key={b.id} label={`${b.name}${b.timing ? ` (${b.timing})` : ''}`}>{bs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
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
                  <input className="input" type="number" placeholder="2500" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input className="input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
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

      {/* Summary cards */}
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

      {/* Tabs + Batch Filter */}
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

      {/* Bulk action bar */}
      {tab === 'pending' && visiblePending.length > 0 && (
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="btn-warning flex-1 text-xs py-2 gap-1.5">
            <WAIcon /> Remind All ({visiblePending.length})
          </button>
          <button onClick={handleBulkLateFees} disabled={bulkLate} className="btn-secondary flex-1 text-xs py-2 gap-1.5" title="Apply late fees to all overdue fees">
            {bulkLate
              ? <><span className="spinner w-3.5 h-3.5" /> Applying…</>
              : <><svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Late Fees All</>
            }
          </button>
        </div>
      )}

      {/* Fee List */}
      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-brand-400" /></div>
      ) : visibleFees.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-sm font-bold text-slate-700">{tab === 'pending' ? 'No pending fees 🎉' : 'No fee records yet'}</p>
          <p className="text-xs text-slate-400 mt-1">{tab === 'pending' ? 'All fees have been collected!' : 'Use "Assign Fee" to add your first fee record.'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleFees.map(fee => {
            const isExpanded      = expandedIds.has(fee.id)
            const bal             = balances[fee.id] ?? null
            const isBalLoading    = balanceLoading.has(fee.id)
            const isBusy          = busyIds.has(fee.id)
            const displayStatus   = (bal?.effective_status as FeeStatus) ?? fee.status
            const overdue         = displayStatus === 'overdue'
            const canLateFee      = displayStatus === 'overdue' || displayStatus === 'partial'
            const displayTotal    = getDisplayTotal(fee)
            const displayBalance  = bal ? Number(bal.balance_due) : fee.total_amount

            return (
              <div key={fee.id} className={`card overflow-hidden ${overdue ? 'border-red-200' : ''}`}>
                <div className="p-4">
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 select-none ${overdue ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'}`}>
                      {fee.students?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{fee.students?.name}</span>
                        <StatusBadge status={displayStatus} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fee.students?.batch_name_legacy ?? ''} · Due {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {/* Balance due + correct total (base + late fee) */}
                      <div className="flex items-baseline gap-2 mt-1.5">
                        <p className="text-xl font-bold text-slate-800 font-mono tracking-tight">
                          ₹{displayBalance.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-slate-400">
                          of ₹{displayTotal.toLocaleString('en-IN')}
                          {bal && Number(bal.late_fee_amount) > 0 && (
                            <span className="text-orange-500 ml-1">(+₹{Number(bal.late_fee_amount).toLocaleString('en-IN')} late)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {/* Expand toggle */}
                    <button onClick={() => toggleExpand(fee.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors shrink-0"
                      title={isExpanded ? 'Hide balance' : 'Show balance breakdown'}>
                      <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>

                  {/* Balance breakdown */}
                  {isExpanded && <div className="mt-3"><FeeBalanceRow balance={bal} loading={isBalLoading} /></div>}

                  {/* Action buttons — non-paid fees */}
                  {fee.status !== 'paid' && (
                    <div className="flex gap-1.5 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                      {/* WhatsApp */}
                      <button onClick={() => sendReminder(fee)} className="btn-secondary flex-none px-2.5 py-2 text-xs" title="Send WhatsApp reminder">
                        <WAIcon />
                      </button>
                      {/* Partial pay (modal) */}
                      <button onClick={() => { loadBalance(fee.id); setPayingFee(fee) }} className="btn-secondary flex-1 py-2 text-xs gap-1.5 min-w-[52px]">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Pay
                      </button>
                      {/* Quick Pay Full */}
                      <button onClick={() => handleQuickPayFull(fee)} disabled={isBusy} className="btn-primary flex-1 py-2 text-xs gap-1.5 min-w-[72px]" title="Pay full remaining balance instantly">
                        {isBusy
                          ? <span className="spinner w-3.5 h-3.5" />
                          : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Pay Full</>
                        }
                      </button>
                      {/* Apply Late Fee */}
                      <button onClick={() => handleApplyLateFee(fee)} disabled={isBusy || !canLateFee}
                        className={`flex-1 py-2 text-xs gap-1.5 min-w-[72px] ${canLateFee ? 'btn-secondary text-orange-600 border-orange-200 hover:bg-orange-50' : 'btn-secondary opacity-40 cursor-not-allowed'}`}
                        title={canLateFee ? 'Apply late fee penalty' : 'Only for overdue/partial fees'}>
                        {isBusy
                          ? <span className="spinner w-3.5 h-3.5" />
                          : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Late Fee</>
                        }
                      </button>
                      {/* Invoice */}
                      <button onClick={() => generateInvoicePDF(fee, bal)} className="btn-secondary flex-none px-2.5 py-2 text-xs text-slate-500" title="Download PDF invoice">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </div>
                  )}

                  {/* Invoice button for paid fees */}
                  {fee.status === 'paid' && (
                    <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
                      <button onClick={() => generateInvoicePDF(fee, bal)} className="btn-secondary px-3 py-1.5 text-xs gap-1.5 text-slate-500" title="Download PDF invoice">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Invoice
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
