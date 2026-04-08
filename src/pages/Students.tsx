import { useCallback, useEffect, useState } from 'react'
import { getStudents, addStudent, deleteStudent, extractError, type Student } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import Toast, { useToast } from '../components/Toast'

const BATCHES = ['Morning', 'Afternoon', 'Evening', 'Weekend']

export default function Students() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [form, setForm]         = useState({ name: '', phone: '', batch: 'Morning' })
  const { toast, show, hide }   = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStudents(await getStudents())
    } catch (e) {
      show(`Failed to load students: ${extractError(e)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    const name  = form.name.trim()
    const phone = form.phone.trim()
    if (!name || !phone) return
    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      show('Phone number must be exactly 10 digits', 'error')
      return
    }
    setSaving(true)
    try {
      await addStudent({ name, phone, batch: form.batch })
      setForm({ name: '', phone: '', batch: 'Morning' })
      setShowForm(false)
      show('Student added successfully')
      await load()
    } catch (e) {
      show(`Failed to add student: ${extractError(e)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the system? Their fees and attendance records will also be deleted.`)) return
    try {
      await deleteStudent(id)
      show(`${name} removed`)
      await load()
    } catch (e) {
      show(`Failed to remove student: ${extractError(e)}`, 'error')
    }
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.batch.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  )

  const grouped = BATCHES.reduce<Record<string, Student[]>>((acc, b) => {
    acc[b] = filtered.filter(s => s.batch === b)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${students.length} enrolled`}
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Student
          </button>
        }
      />

      {/* ── Add Form ── */}
      {showForm && (
        <div className="card p-4 mb-5 border-navy-200">
          <p className="text-sm font-semibold text-navy-900 mb-4">New Student</p>
          <div className="space-y-3">
            <div>
              <label className="label">Full Name</label>
              <input
                className="input"
                placeholder="e.g. Arjun Sharma"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input
                className="input"
                type="tel"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                maxLength={10}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="label">Batch</label>
              <div className="relative">
                <select
                  className="select"
                  value={form.batch}
                  onChange={e => setForm(f => ({ ...f, batch: e.target.value }))}
                >
                  {BATCHES.map(b => <option key={b}>{b}</option>)}
                </select>
                <svg className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={saving || !form.name.trim() || form.phone.trim().length !== 10}
                className="btn-primary flex-1"
              >
                {saving ? <span className="spinner" /> : 'Save Student'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          className="input pl-9"
          placeholder="Search by name, batch, or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Batch Tabs ── */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {BATCHES.map(b => {
          const count = grouped[b]?.length ?? 0
          return (
            <div key={b} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
              <span>{b}</span>
              <span className="w-4 h-4 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                {count}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="spinner text-navy-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No students match your search' : 'No students yet'}
          description={search ? 'Try a different name or batch.' : 'Click "Add Student" to enroll your first student.'}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-4">
          {BATCHES.map(batch => {
            const list = grouped[batch]
            if (!list || list.length === 0) return null
            return (
              <div key={batch} className="card overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {batch} Batch
                  </span>
                  <span className="text-xs text-slate-400">{list.length} student{list.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {list.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-navy-100 text-navy-700 font-semibold text-sm flex items-center justify-center shrink-0 select-none">
                        {s.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy-900 truncate">{s.name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{s.phone}</p>
                      </div>
                      <a
                        href={`https://wa.me/91${s.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                        title="Open WhatsApp"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.029 18.88a7.947 7.947 0 01-4.031-1.086l-.289-.172-2.995.786.8-2.924-.188-.302A7.933 7.933 0 014.07 12.03C4.07 7.624 7.624 4.07 12.03 4.07c2.137 0 4.142.833 5.652 2.344a7.935 7.935 0 012.334 5.638c-.001 4.406-3.555 7.828-7.987 7.828z"/>
                        </svg>
                      </a>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove student"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
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
