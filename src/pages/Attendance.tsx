import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getStudents, getBatches, getAttendanceByDate, upsertAttendance,
  extractError, type Student, type Batch,
} from '../lib/supabase'
import Toast, { useToast } from '../components/Toast'

type AttMap = Record<string, 'present' | 'absent'>

export default function AttendancePage() {
  const [students,      setStudents]      = useState<Student[]>([])
  const [batches,       setBatches]       = useState<Batch[]>([])
  const [attendance,    setAttendance]    = useState<AttMap>({})
  const [selectedBatch, setSelectedBatch] = useState('')
  const [date,          setDate]          = useState(new Date().toISOString().split('T')[0])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const { toast, show, hide }             = useToast()

  // ── FIX: Use refs to always hold the latest values inside async callbacks.
  // The `save` function was closing over stale `attendance` and `batchStudents`
  // from the render where it was created — so it always sent the initial
  // empty-map values to Supabase, not what the user had toggled.
  const attendanceRef    = useRef<AttMap>({})
  const batchStudentsRef = useRef<Student[]>([])
  const dateRef          = useRef(date)

  // Keep refs in sync with state on every render
  attendanceRef.current = attendance
  dateRef.current       = date

  const batchStudents = students.filter(s => s.batch === selectedBatch)
  batchStudentsRef.current = batchStudents

  const isToday = date === new Date().toISOString().split('T')[0]

  const load = useCallback(async (currentDate: string, currentBatch?: string) => {
    setLoading(true)
    setSaved(false)
    const [sRes, bRes, aRes] = await Promise.allSettled([
      getStudents(),
      getBatches(),
      getAttendanceByDate(currentDate),
    ])

    let allStudents: Student[] = []

    if (sRes.status === 'fulfilled') {
      allStudents = sRes.value
      setStudents(sRes.value)
    } else {
      show(`Could not load students: ${extractError(sRes.reason)}`, 'error')
    }

    if (bRes.status === 'fulfilled') {
      setBatches(bRes.value)
      // Auto-select first batch only if nothing is selected yet
      if (bRes.value.length > 0 && !currentBatch) {
        setSelectedBatch(bRes.value[0].name)
      }
    } else {
      show(`Could not load batches: ${extractError(bRes.reason)}`, 'error')
    }

    // Build attendance map: DB records override, fill rest with 'present'
    const map: AttMap = {}
    allStudents.forEach(s => { map[s.id] = 'present' })
    if (aRes.status === 'fulfilled') {
      aRes.value.forEach(r => { map[r.student_id] = r.status })
    }
    setAttendance(map)
    setLoading(false)
  }, [show])

  // Reload when date changes
  useEffect(() => {
    load(date, selectedBatch || undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Initial load
  useEffect(() => {
    load(date)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (id: string) => {
    setSaved(false)
    setAttendance(a => ({ ...a, [id]: a[id] === 'present' ? 'absent' : 'present' }))
  }

  const allPre = () => {
    setSaved(false)
    setAttendance(a => {
      const u = { ...a }
      batchStudentsRef.current.forEach(s => { u[s.id] = 'present' })
      return u
    })
  }

  const allAbs = () => {
    setSaved(false)
    setAttendance(a => {
      const u = { ...a }
      batchStudentsRef.current.forEach(s => { u[s.id] = 'absent' })
      return u
    })
  }

  // ── FIX: Read from refs, not from closed-over state ──
  const save = async () => {
    const students = batchStudentsRef.current
    const att      = attendanceRef.current
    const d        = dateRef.current

    if (!students.length) {
      show('No students in this batch', 'error')
      return
    }

    setSaving(true)
    setSaved(false)

    const records = students.map(s => ({
      student_id: s.id,
      date:       d,
      status:     att[s.id] ?? 'present',
    }))

    console.log('[Attendance] Saving', records.length, 'records for', d)

    try {
      await upsertAttendance(records)
      setSaved(true)
      show('Attendance saved successfully ✓')
      console.log('[Attendance] Saved successfully')
    } catch (e) {
      const msg = extractError(e)
      console.error('[Attendance] Save failed:', e)
      show(`Failed to save: ${msg}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const notifyAbsentees = () => {
    const abs = batchStudentsRef.current.filter(s => attendanceRef.current[s.id] === 'absent')
    if (!abs.length) { show('No absentees to notify 🎉', 'info'); return }
    const d = new Date(dateRef.current).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

    // Open first tab immediately (allowed by browser), then guide through rest
    if (abs.length === 1) {
      const s   = abs[0]
      const msg = encodeURIComponent(`Dear ${s.name},\n\nYou were *absent* on ${d} for the ${s.batch} batch.\n\nPlease attend regularly.\n\n— CoachPro Institute`)
      window.open(`https://wa.me/91${s.phone}?text=${msg}`, '_blank')
      show('WhatsApp opened for absentee', 'info')
    } else {
      // Open first one immediately, show count for rest
      const first = abs[0]
      const msg   = encodeURIComponent(`Dear ${first.name},\n\nYou were *absent* on ${d} for the ${first.batch} batch.\n\nPlease attend regularly.\n\n— CoachPro Institute`)
      window.open(`https://wa.me/91${first.phone}?text=${msg}`, '_blank')
      show(`Opened WhatsApp for ${first.name}. ${abs.length - 1} more to notify — click again.`, 'info')
    }
  }

  const presentCount = batchStudents.filter(s => attendance[s.id] !== 'absent').length
  const absentCount  = batchStudents.length - presentCount
  const pct          = batchStudents.length > 0 ? Math.round(presentCount / batchStudents.length * 100) : 0

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {batchStudents.length > 0
            ? `${selectedBatch} · ${presentCount}/${batchStudents.length} present · ${pct}%`
            : 'Select a batch to begin'}
        </p>
      </div>

      {/* ── Date + Batch selector ── */}
      <div className="card p-4 space-y-4">
        <div>
          <label className="label">Date</label>
          <div className="flex gap-2">
            <input
              className="input flex-1" type="date" value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setDate(e.target.value)}
            />
            {!isToday && (
              <button
                onClick={() => setDate(new Date().toISOString().split('T')[0])}
                className="btn-secondary shrink-0 text-xs"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {batches.length > 0 && (
          <div>
            <label className="label">Batch</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {batches.map(b => {
                const cnt = students.filter(s => s.batch === b.name).length
                return (
                  <button
                    key={b.id}
                    onClick={() => { setSaved(false); setSelectedBatch(b.name) }}
                    className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all text-left ${
                      selectedBatch === b.name
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block truncate">{b.name}</span>
                    <span className={`text-[10px] font-medium ${selectedBatch === b.name ? 'text-brand-200' : 'text-slate-400'}`}>
                      {b.timing || `${cnt} student${cnt !== 1 ? 's' : ''}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {batches.length === 0 && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium">No batches found. Go to Students page to create batches first.</p>
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      {batchStudents.length > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Rate</span>
            <span className={`text-sm font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-5 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-500">{presentCount} Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs font-medium text-slate-500">{absentCount} Absent</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk actions ── */}
      {batchStudents.length > 0 && (
        <div className="flex gap-2">
          <button onClick={allPre} className="btn-secondary flex-1 text-xs py-2">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            All Present
          </button>
          <button onClick={allAbs} className="btn-secondary flex-1 text-xs py-2">
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            All Absent
          </button>
          <button onClick={notifyAbsentees} disabled={absentCount === 0} className="btn-warning flex-1 text-xs py-2">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
            Notify ({absentCount})
          </button>
        </div>
      )}

      {/* ── Student Cards ── */}
      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-brand-400" /></div>
      ) : batchStudents.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-700">
            {students.length === 0 ? 'No students yet' : `No students in ${selectedBatch || 'this batch'}`}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {students.length === 0 ? 'Add students from the Students page first.' : 'Add students to this batch from the Students page.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tap to toggle present / absent</p>
          <div className="space-y-2">
            {batchStudents.map(s => {
              const isPresent = attendance[s.id] !== 'absent'
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`w-full card p-3.5 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98] ${
                    isPresent
                      ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                      : 'border-red-200 bg-red-50/40 hover:bg-red-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
                    isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{s.phone}</p>
                  </div>
                  <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    isPresent ? 'bg-emerald-500 text-white' : 'bg-red-400 text-white'
                  }`}>
                    {isPresent
                      ? <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> P</>
                      : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> A</>
                    }
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Save Button ── */}
          <button
            onClick={save}
            disabled={saving || saved}
            className={`w-full py-3.5 font-semibold text-sm rounded-xl transition-all ${
              saved
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                : 'btn-primary'
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner w-4 h-4" /> Saving…
              </span>
            ) : saved ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Attendance Saved
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Attendance
              </span>
            )}
          </button>

          {saved && (
            <p className="text-center text-xs text-slate-400">
              Changes saved · <button onClick={() => setSaved(false)} className="underline hover:text-slate-600">Make more changes</button>
            </p>
          )}
        </div>
      )}

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
