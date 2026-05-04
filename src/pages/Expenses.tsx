import { useCallback, useEffect, useState } from 'react'
import {
  getExpenses, addExpense, deleteExpense,
  extractError, type Expense, type ExpenseCategory,
} from '../lib/supabase'
import Toast, { useToast } from '../components/Toast'

const CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'rent',        label: 'Rent',        color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
  { value: 'salary',      label: 'Salary',      color: 'bg-blue-100   dark:bg-blue-900/30   text-blue-700   dark:text-blue-400' },
  { value: 'utilities',   label: 'Utilities',   color: 'bg-cyan-100   dark:bg-cyan-900/30   text-cyan-700   dark:text-cyan-400' },
  { value: 'supplies',    label: 'Supplies',    color: 'bg-amber-100  dark:bg-amber-900/30  text-amber-700  dark:text-amber-400' },
  { value: 'marketing',   label: 'Marketing',   color: 'bg-pink-100   dark:bg-pink-900/30   text-pink-700   dark:text-pink-400' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  { value: 'other',       label: 'Other',       color: 'bg-slate-100  dark:bg-slate-700     text-slate-600  dark:text-slate-400' },
]

function categoryStyle(cat: ExpenseCategory) {
  return CATEGORIES.find(c => c.value === cat)?.color ?? CATEGORIES[CATEGORIES.length - 1].color
}
function categoryLabel(cat: ExpenseCategory) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? 'Other'
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ExpensesPage() {
  const now = new Date()
  const [expenses,    setExpenses]   = useState<Expense[]>([])
  const [loading,     setLoading]    = useState(true)
  const [saving,      setSaving]     = useState(false)
  const [showForm,    setShowForm]   = useState(false)
  const [filterYear,  setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth]= useState(now.getMonth() + 1)
  const [form, setForm] = useState<{
    title: string; amount: string; category: ExpenseCategory; date: string; notes: string
  }>({
    title: '', amount: '', category: 'other',
    date: now.toISOString().split('T')[0], notes: '',
  })
  const { toast, show, hide } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getExpenses(filterYear, filterMonth)
      setExpenses(data)
    } catch (e) { show(extractError(e), 'error') }
    finally { setLoading(false) }
  }, [filterYear, filterMonth, show])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!form.title.trim() || !form.amount || !form.date) return
    setSaving(true)
    try {
      await addExpense({
        title:    form.title.trim(),
        amount:   Number(form.amount),
        category: form.category,
        date:     form.date,
        notes:    form.notes.trim() || null,
      })
      setForm({ title: '', amount: '', category: 'other', date: now.toISOString().split('T')[0], notes: '' })
      setShowForm(false)
      show('Expense added ✓')
      await load()
    } catch (e) { show(extractError(e), 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete expense "${title}"?`)) return
    try { await deleteExpense(id); show(`"${title}" deleted`); await load() }
    catch (e) { show(extractError(e), 'error') }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.value).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(c => c.total > 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {MONTH_NAMES[filterMonth - 1]} {filterYear} · ₹{total.toLocaleString('en-IN')} total
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Expense
        </button>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">New Expense</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Title</label>
                <input className="input" placeholder="e.g. Monthly Rent" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="label">Amount (₹)</label>
                <input className="input" type="number" min="1" placeholder="5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <div className="relative">
                  <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <svg className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input className="input" placeholder="Any additional details…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAdd} disabled={saving || !form.title.trim() || !form.amount || !form.date} className="btn-primary flex-1">
                {saving ? <span className="spinner" /> : 'Save Expense'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Month filter */}
      <div className="flex gap-2 items-center">
        <button onClick={() => {
          if (filterMonth === 1) { setFilterMonth(12); setFilterYear(y => y - 1) }
          else setFilterMonth(m => m - 1)
        }} className="btn-secondary px-2.5 py-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{MONTH_NAMES[filterMonth - 1]} {filterYear}</span>
        </div>
        <button onClick={() => {
          if (filterMonth === 12) { setFilterMonth(1); setFilterYear(y => y + 1) }
          else setFilterMonth(m => m + 1)
        }} className="btn-secondary px-2.5 py-2" disabled={filterYear === now.getFullYear() && filterMonth === now.getMonth() + 1}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Total summary card */}
      {!loading && expenses.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Spent</p>
            <p className="text-2xl font-bold text-red-500 mt-1 tracking-tight">₹{total.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Avg per Day</p>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1 tracking-tight">
              ₹{Math.round(total / new Date(filterYear, filterMonth, 0).getDate()).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">this month</p>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {!loading && byCategory.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">By Category</p>
          <div className="space-y-2.5">
            {byCategory.sort((a, b) => b.total - a.total).map(cat => (
              <div key={cat.value}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`font-semibold px-2 py-0.5 rounded-md ${cat.color}`}>{cat.label}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">₹{cat.total.toLocaleString('en-IN')}</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all"
                       style={{ width: `${Math.round((cat.total / total) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense list */}
      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-brand-400" /></div>
      ) : expenses.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No expenses for {MONTH_NAMES[filterMonth - 1]} {filterYear}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click "Add Expense" to track your first expense.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {expenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{exp.title}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${categoryStyle(exp.category)}`}>
                      {categoryLabel(exp.category)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {exp.notes && ` · ${exp.notes}`}
                  </p>
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 font-mono shrink-0">₹{Number(exp.amount).toLocaleString('en-IN')}</p>
                <button onClick={() => handleDelete(exp.id, exp.title)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
