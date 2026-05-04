import { useCallback, useEffect, useState } from 'react'
import {
  getStudents, addStudent, deleteStudent,
  getBatches, addBatch, deleteBatch,
  getFees, computeStudentRisks,
  extractError, type Student, type Batch, type StudentRisk,
} from '../lib/supabase'
import Toast, { useToast } from '../components/Toast'

type RiskLabel = StudentRisk['risk_label']

function RiskBadge({ label }: { label: RiskLabel }) {
  const styles: Record<RiskLabel, string> = {
    'Good':      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    'Warning':   'bg-amber-100   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400',
    'High Risk': 'bg-red-100     dark:bg-red-900/30     text-red-600     dark:text-red-400',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${styles[label]}`}>{label}</span>
}

export default function Students() {
  const [students,    setStudents]    = useState<Student[]>([])
  const [batches,     setBatches]     = useState<Batch[]>([])
  const [riskMap,     setRiskMap]     = useState<Map<string, StudentRisk>>(new Map())
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [showBatches, setShowBatches] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [search,      setSearch]      = useState('')
  const [activeBatch, setActiveBatch] = useState<string>('all')
  const [sortByRisk,  setSortByRisk]  = useState(false)
  const [form, setForm]     = useState({ name: '', phone: '', batch_id: '' })
  const [newBatch, setNewBatch] = useState({ name: '', timing: '' })
  const { toast, show, hide } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const [sRes, bRes, fRes] = await Promise.allSettled([getStudents(), getBatches(), getFees()])
    let allStudents: Student[] = []
    if (sRes.status === 'fulfilled') { allStudents = sRes.value; setStudents(sRes.value) }
    else show(`Could not load students: ${extractError(sRes.reason)}`, 'error')
    if (bRes.status === 'fulfilled') {
      setBatches(bRes.value)
      if (bRes.value.length > 0 && !form.batch_id)
        setForm(f => ({ ...f, batch_id: bRes.value[0].id }))
    } else show(`Could not load batches: ${extractError(bRes.reason)}`, 'error')

    // Compute risk using fees data
    if (allStudents.length > 0 && fRes.status === 'fulfilled') {
      try { setRiskMap(await computeStudentRisks(allStudents.map(s => s.id))) } catch { /* non-fatal */ }
    }
    setLoading(false)
  }, [show]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (batches.length > 0 && !form.batch_id)
      setForm(f => ({ ...f, batch_id: batches[0].id }))
  }, [batches]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddStudent = async () => {
    const name = form.name.trim(), phone = form.phone.trim()
    if (!name || !phone || !form.batch_id) return
    if (phone.length !== 10 || !/^\d+$/.test(phone)) { show('Phone must be exactly 10 digits', 'error'); return }
    setSaving(true)
    try {
      await addStudent({ name, phone, batch_id: form.batch_id })
      setForm(f => ({ ...f, name: '', phone: '' }))
      setShowForm(false); show('Student added ✓'); await load()
    } catch (e) { show(`Failed to add student: ${extractError(e)}`, 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Their fees and attendance records will also be deleted.`)) return
    try { await deleteStudent(id); show(`${name} removed`); await load() }
    catch (e) { show(`Failed: ${extractError(e)}`, 'error') }
  }

  const handleAddBatch = async () => {
    if (!newBatch.name.trim()) return
    try { await addBatch({ name: newBatch.name.trim(), timing: newBatch.timing.trim() }); setNewBatch({ name: '', timing: '' }); show('Batch created ✓'); await load() }
    catch (e) { show(`Failed: ${extractError(e)}`, 'error') }
  }

  const handleDeleteBatch = async (b: Batch) => {
    if (students.some(s => s.batch_id === b.id)) { show('Cannot delete — students are assigned to this batch', 'error'); return }
    if (!confirm(`Delete batch "${b.name}"?`)) return
    try { await deleteBatch(b.id); show(`Batch "${b.name}" deleted`); await load() }
    catch (e) { show(`Failed: ${extractError(e)}`, 'error') }
  }

  const batchName = (s: Student) => s.batches?.name ?? s.batch_name_legacy

  let filtered = students.filter(s => {
    const matchBatch  = activeBatch === 'all' || s.batch_id === activeBatch
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                        s.phone.includes(search) ||
                        batchName(s).toLowerCase().includes(search.toLowerCase())
    return matchBatch && matchSearch
  })

  if (sortByRisk) {
    filtered = [...filtered].sort((a, b) => {
      const ra = riskMap.get(a.id)?.risk_score ?? 0
      const rb = riskMap.get(b.id)?.risk_score ?? 0
      return rb - ra
    })
  }

  const grouped = batches.reduce<Record<string, Student[]>>((acc, b) => {
    acc[b.id] = filtered.filter(s => s.batch_id === b.id)
    return acc
  }, {})
  filtered.forEach(s => { if (!grouped[s.batch_id]) grouped[s.batch_id] = [s] })

  const highRiskCount = filtered.filter(s => riskMap.get(s.id)?.risk_label === 'High Risk').length

  return (
    <div className="space-y-5">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Students</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{students.length} enrolled across {batches.length} batch{batches.length !== 1 ? 'es' : ''}</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setShowBatches(false) }} className="btn-primary shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Student
        </button>
      </div>

      {/* High risk banner */}
      {!loading && highRiskCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          <p className="text-xs text-red-700 dark:text-red-400 flex-1 font-medium">{highRiskCount} student{highRiskCount > 1 ? 's are' : ' is'} High Risk — overdue fees detected</p>
          <button onClick={() => setSortByRisk(true)} className="text-xs font-bold text-red-600 underline shrink-0">Sort by risk</button>
        </div>
      )}

      {/* Add Student Form */}
      {showForm && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">New Student</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {batches.length === 0 ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">⚠ No batches yet. Create a batch first.</p>
              <button onClick={() => { setShowForm(false); setShowBatches(true) }} className="text-xs font-bold text-amber-700 dark:text-amber-400 underline mt-1">Create a batch →</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input" placeholder="e.g. Arjun Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input className="input" type="tel" placeholder="10-digit number" inputMode="numeric" value={form.phone} maxLength={10}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,'') }))} />
                </div>
              </div>
              <div>
                <label className="label">Batch</label>
                <div className="relative">
                  <select className="select" value={form.batch_id} onChange={e => setForm(f => ({ ...f, batch_id: e.target.value }))}>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}{b.timing ? ` (${b.timing})` : ''}</option>)}
                  </select>
                  <svg className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddStudent} disabled={saving || !form.name.trim() || form.phone.trim().length !== 10 || !form.batch_id} className="btn-primary flex-1">
                  {saving ? <span className="spinner" /> : 'Save Student'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manage Batches */}
      <div className="card overflow-hidden">
        <button onClick={() => setShowBatches(!showBatches)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Manage Batches</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{batches.length} batch{batches.length !== 1 ? 'es' : ''} · Click to {showBatches ? 'hide' : 'add or remove'}</p>
            </div>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showBatches ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {showBatches && (
          <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-3">
            {batches.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">No batches yet.</p>
            ) : (
              <div className="space-y-2">
                {batches.map(b => {
                  const count = students.filter(s => s.batch_id === b.id).length
                  return (
                    <div key={b.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{b.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{b.timing || 'No timing set'} · {count} student{count !== 1 ? 's' : ''}</p>
                      </div>
                      <button onClick={() => handleDeleteBatch(b)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <input className="input flex-1" placeholder="Batch name (e.g. Morning)" value={newBatch.name} onChange={e => setNewBatch(b => ({ ...b, name: e.target.value }))} />
              <input className="input w-32" placeholder="Timing (9–11am)" value={newBatch.timing} onChange={e => setNewBatch(b => ({ ...b, timing: e.target.value }))} />
              <button onClick={handleAddBatch} disabled={!newBatch.name.trim()} className="btn-primary shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter + sort bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input className="input pl-9" placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0">
          <button onClick={() => setActiveBatch('all')}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${activeBatch === 'all' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
            All ({students.length})
          </button>
          {batches.map(b => {
            const count = students.filter(s => s.batch_id === b.id).length
            return (
              <button key={b.id} onClick={() => setActiveBatch(b.id)}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${activeBatch === b.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                {b.name} ({count})
              </button>
            )
          })}
          <button onClick={() => setSortByRisk(r => !r)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${sortByRisk ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
            {sortByRisk ? '⚠ By Risk' : 'Sort by Risk'}
          </button>
        </div>
      </div>

      {/* Student list */}
      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-brand-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
            {search ? 'No students match your search' : batches.length === 0 ? 'Create a batch first' : 'No students yet'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
            {search ? 'Try different keywords.' : batches.length === 0 ? 'Add a batch above, then enroll your first student.' : 'Click "Add Student" to get started.'}
          </p>
          {!search && batches.length > 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add First Student
            </button>
          )}
        </div>
      ) : sortByRisk ? (
        // Flat sorted list when sort-by-risk active
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sorted by risk score</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map(s => {
              const risk = riskMap.get(s.id)
              const isHigh = risk?.risk_label === 'High Risk'
              return (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${isHigh ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                  <div className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center shrink-0 select-none ${isHigh ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'}`}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{s.phone}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    {risk && <RiskBadge label={risk.risk_label} />}
                    {risk && risk.total_pending > 0 && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">₹{risk.total_pending.toLocaleString('en-IN')} pending</p>
                    )}
                  </div>
                  <a href={`https://wa.me/91${s.phone}`} target="_blank" rel="noreferrer"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.029 18.88a7.947 7.947 0 01-4.031-1.086l-.289-.172-2.995.786.8-2.924-.188-.302A7.933 7.933 0 014.07 12.03C4.07 7.624 7.624 4.07 12.03 4.07c2.137 0 4.142.833 5.652 2.344a7.935 7.935 0 012.334 5.638c-.001 4.406-3.555 7.828-7.987 7.828z"/></svg>
                  </a>
                  <button onClick={() => handleDelete(s.id, s.name)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // Grouped by batch
        <div className="space-y-4">
          {Object.entries(grouped).map(([batchKey, list]) => {
            if (!list || list.length === 0) return null
            const batchInfo   = batches.find(b => b.id === batchKey)
            const displayName = batchInfo?.name ?? list[0]?.batch_name_legacy ?? batchKey
            return (
              <div key={batchKey} className="card overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{displayName}</span>
                    {batchInfo?.timing && <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{batchInfo.timing}</span>}
                  </div>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{list.length} student{list.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {list.map(s => {
                    const risk   = riskMap.get(s.id)
                    const isHigh = risk?.risk_label === 'High Risk'
                    return (
                      <div key={s.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors ${isHigh ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                        <div className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center shrink-0 select-none ${isHigh ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'}`}>
                          {s.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{s.name}</p>
                            {risk && risk.risk_label !== 'Good' && <RiskBadge label={risk.risk_label} />}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{s.phone}</p>
                        </div>
                        <a href={`https://wa.me/91${s.phone}`} target="_blank" rel="noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.029 18.88a7.947 7.947 0 01-4.031-1.086l-.289-.172-2.995.786.8-2.924-.188-.302A7.933 7.933 0 014.07 12.03C4.07 7.624 7.624 4.07 12.03 4.07c2.137 0 4.142.833 5.652 2.344a7.935 7.935 0 012.334 5.638c-.001 4.406-3.555 7.828-7.987 7.828z"/></svg>
                        </a>
                        <button onClick={() => handleDelete(s.id, s.name)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )
                  })}
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
