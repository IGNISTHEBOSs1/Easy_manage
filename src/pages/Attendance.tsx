import { useEffect, useState } from 'react'
import {
  getStudents, getAttendanceByDate, upsertAttendance,
  type Student,
} from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import Toast, { useToast } from '../components/Toast'

const BATCHES = ['Morning', 'Afternoon', 'Evening', 'Weekend']

type AttendanceMap = Record<string, 'present' | 'absent'>

export default function AttendancePage() {
  const [students, setStudents]           = useState<Student[]>([])
  const [attendance, setAttendance]       = useState<AttendanceMap>({})
  const [selectedBatch, setSelectedBatch] = useState('Morning')
  const [date, setDate]                   = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const { toast, show, hide }             = useToast()

  const batchStudents = students.filter(s => s.batch === selectedBatch)

  const load = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const [allStudents, records] = await Promise.all([
        getStudents(),
        getAttendanceByDate(date),
      ])
      setStudents(allStudents)

      const map: AttendanceMap = {}
      // Pre-fill from saved records
      records.forEach(r => { map[r.student_id] = r.status })
      // Default un-saved students to present
      allStudents.forEach(s => { if (!(s.id in map)) map[s.id] = 'present' })
      setAttendance(map)
    } catch { show('Failed to load attendance', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const toggle = (id: string) => {
    setSaved(false)
    setAttendance(a => ({ ...a, [id]: a[id] === 'present' ? 'absent' : 'present' }))
  }

  const markAllPresent = () => {
    setSaved(false)
    setAttendance(a => {
      const updated = { ...a }
      batchStudents.forEach(s => { updated[s.id] = 'present' })
      return updated
    })
  }

  const markAllAbsent = () => {
    setSaved(false)
    setAttendance(a => {
      const updated = { ...a }
      batchStudents.forEach(s => { updated[s.id] = 'absent' })
      return updated
    })
  }

  const saveAttendance = async () => {
    if (batchStudents.length === 0) return
    setSaving(true)
    try {
      const records = batchStudents.map(s => ({
        student_id: s.id,
        date,
        status: attendance[s.id] ?? 'present',
      }))
      await upsertAttendance(records)
      setSaved(true)
      show('Attendance saved successfully')
    } catch { show('Failed to save attendance', 'error') }
    finally { setSaving(false) }
  }

  const notifyAbsentees = () => {
    const absentees = batchStudents.filter(s => attendance[s.id] === 'absent')
    if (absentees.length === 0) {
      show('No absentees in this batch today 🎉', 'info')
      return
    }
    const displayDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    absentees.forEach((s, i) => {
      setTimeout(() => {
        const msg = encodeURIComponent(
          `Dear ${s.name},\n\nYou were *absent* on ${displayDate} for the ${s.batch} batch.\n\nPlease attend regularly. If you have any concerns, reach out to us.\n\n— CoachPro Institute`
        )
        window.open(`https://wa.me/91${s.phone}?text=${msg}`, '_blank')
      }, i * 700)
    })
    show(`Notifying ${absentees.length} absentee${absentees.length > 1 ? 's' : ''} via WhatsApp`, 'info')
  }

  const presentCount = batchStudents.filter(s => attendance[s.id] !== 'absent').length
  const absentCount  = batchStudents.length - presentCount
  const pct          = batchStudents.length > 0 ? Math.round((presentCount / batchStudents.length) * 100) : 0

  const isToday = date === new Date().toISOString().split('T')[0]

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle={batchStudents.length > 0 ? `${presentCount}/${batchStudents.length} present · ${pct}%` : 'Select a batch'}
      />

      {/* ── Date + Batch ── */}
      <div className="card p-4 mb-4 space-y-4">
        <div>
          <label className="label">Date</label>
          <div className="flex gap-2 items-center">
            <input
              className="input flex-1"
              type="date"
              value={date}
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

        <div>
          <label className="label">Batch</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BATCHES.map(b => {
              const bCount = students.filter(s => s.batch === b).length
              return (
                <button
                  key={b}
                  onClick={() => setSelectedBatch(b)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all duration-150 text-left ${
                    selectedBatch === b
                      ? 'bg-navy-800 text-white border-navy-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="block">{b}</span>
                  <span className={`text-[10px] ${selectedBatch === b ? 'text-navy-300' : 'text-slate-400'}`}>
                    {bCount} student{bCount !== 1 ? 's' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {batchStudents.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-slate-500">Attendance Rate</span>
            <span className={`text-sm font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
              {pct}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">{presentCount} Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs text-slate-500">{absentCount} Absent</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Actions ── */}
      {batchStudents.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button onClick={markAllPresent} className="btn-secondary flex-1 text-xs">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            All Present
          </button>
          <button onClick={markAllAbsent} className="btn-secondary flex-1 text-xs">
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            All Absent
          </button>
          <button
            onClick={notifyAbsentees}
            disabled={absentCount === 0}
            className="btn-warning flex-1 text-xs"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
            Notify ({absentCount})
          </button>
        </div>
      )}

      {/* ── Student Cards ── */}
      {loading ? (
        <div className="flex justify-center py-12"><span className="spinner text-navy-400" /></div>
      ) : batchStudents.length === 0 ? (
        <EmptyState
          title="No students in this batch"
          description="Add students and assign them to this batch from the Students page."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>
          }
        />
      ) : (
        <>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Tap to toggle · Tap card to mark absent
          </p>
          <div className="space-y-2 mb-4">
            {batchStudents.map(s => {
              const isPresent = attendance[s.id] !== 'absent'
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`w-full card p-3.5 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.985] ${
                    isPresent
                      ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                      : 'border-red-200 bg-red-50/50 hover:bg-red-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 select-none transition-colors ${
                    isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {s.name[0].toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-900">{s.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{s.phone}</p>
                  </div>

                  {/* Status chip */}
                  <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    isPresent ? 'bg-emerald-500 text-white' : 'bg-red-400 text-white'
                  }`}>
                    {isPresent ? (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        P
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        A
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Save Button */}
          <button
            onClick={saveAttendance}
            disabled={saving || saved}
            className={`w-full py-3 ${saved ? 'btn-secondary' : 'btn-primary'}`}
          >
            {saving ? (
              <span className="spinner" />
            ) : saved ? (
              <>
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Attendance
              </>
            )}
          </button>
        </>
      )}

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
