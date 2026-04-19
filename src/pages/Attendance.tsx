import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getStudents, getBatches, getAttendanceByDate, upsertAttendance,
  extractError, type Student, type Batch,
} from '../lib/supabase'
import Toast, { useToast } from '../components/Toast'

type AttMap = Record<string, 'present' | 'absent'>

// ─── PDF Generator (no external library) ─────────────────────────────────────
function generateAttendancePDF(
  batchName: string,
  batchTiming: string,
  date: string,
  students: Student[],
  attendance: AttMap,
) {
  const presentStudents = students.filter(s => attendance[s.id] !== 'absent')
  const absentStudents  = students.filter(s => attendance[s.id] === 'absent')
  const presentCount    = presentStudents.length
  const absentCount     = absentStudents.length
  const total           = students.length
  const pct             = total > 0 ? Math.round(presentCount / total * 100) : 0

  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const rowsHtml = students.map((s, i) => {
    const isPresent = attendance[s.id] !== 'absent'
    return `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${i + 1}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;font-size:14px;color:#0f172a;">${s.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-family:monospace;">${s.phone}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;">
          <span style="
            display:inline-block;
            padding:3px 12px;
            border-radius:999px;
            font-size:12px;
            font-weight:700;
            letter-spacing:0.05em;
            background:${isPresent ? '#dcfce7' : '#fee2e2'};
            color:${isPresent ? '#15803d' : '#dc2626'};
          ">${isPresent ? 'PRESENT' : 'ABSENT'}</span>
        </td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Attendance Report — ${batchName} — ${date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #0f172a; }

    .page { max-width: 780px; margin: 0 auto; padding: 40px 36px; }

    /* Header */
    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
    .logo-row { display: flex; align-items: center; gap: 12px; }
    .logo-box { width: 44px; height: 44px; background: linear-gradient(135deg,#6366f1,#4f46e5); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .logo-box svg { width: 24px; height: 24px; fill: none; stroke: white; stroke-width: 2; }
    .brand { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
    .brand-sub { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }
    .report-label { text-align: right; }
    .report-title { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
    .report-date { font-size: 13px; color: #64748b; margin-top: 4px; }

    /* Meta row */
    .meta { display: flex; gap: 12px; margin-bottom: 24px; }
    .meta-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
    .meta-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
    .meta-value { font-size: 16px; font-weight: 700; color: #0f172a; }
    .meta-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }

    /* Stats */
    .stats { display: flex; gap: 12px; margin-bottom: 28px; }
    .stat { flex: 1; border-radius: 12px; padding: 16px; text-align: center; }
    .stat-present { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .stat-absent  { background: #fff1f2; border: 1px solid #fecdd3; }
    .stat-total   { background: #eef2ff; border: 1px solid #c7d2fe; }
    .stat-pct     { background: #fffbeb; border: 1px solid #fde68a; }
    .stat-num { font-size: 28px; font-weight: 800; }
    .stat-present .stat-num { color: #16a34a; }
    .stat-absent  .stat-num { color: #dc2626; }
    .stat-total   .stat-num { color: #4f46e5; }
    .stat-pct     .stat-num { color: #d97706; }
    .stat-lbl { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; }

    /* Progress bar */
    .progress-wrap { margin-bottom: 28px; }
    .progress-label { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: #64748b; }
    .progress-bar { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 999px; background: ${pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'}; width: ${pct}%; }

    /* Table */
    .table-wrap { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 32px; }
    table { width: 100%; border-collapse: collapse; }
    thead { background: #0f172a; }
    thead th { padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
    thead th:last-child { text-align: center; }

    /* Absentees section */
    .absentees { margin-bottom: 28px; }
    .section-title { font-size: 13px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .section-title::after { content: ''; flex: 1; height: 1px; background: #fecdd3; }
    .absent-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .absent-chip { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 600; color: #dc2626; }

    /* Footer */
    .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 11px; color: #94a3b8; }
    .footer-right { font-size: 11px; color: #94a3b8; }
    .sig-line { margin-top: 48px; border-top: 1px solid #334155; display: inline-block; padding-top: 6px; font-size: 11px; color: #64748b; min-width: 160px; text-align: center; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-row">
      <div class="logo-box">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
      </div>
      <div>
        <div class="brand">CoachPro</div>
        <div class="brand-sub">Institute Manager</div>
      </div>
    </div>
    <div class="report-label">
      <div class="report-title">Attendance Report</div>
      <div class="report-date">${formattedDate}</div>
    </div>
  </div>

  <!-- Meta -->
  <div class="meta">
    <div class="meta-card">
      <div class="meta-label">Batch</div>
      <div class="meta-value">${batchName}</div>
      ${batchTiming ? `<div class="meta-sub">${batchTiming}</div>` : ''}
    </div>
    <div class="meta-card">
      <div class="meta-label">Date</div>
      <div class="meta-value">${new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      <div class="meta-sub">${new Date(date).toLocaleDateString('en-IN', { weekday: 'long' })}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Generated</div>
      <div class="meta-value" style="font-size:13px;">${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="meta-sub">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats">
    <div class="stat stat-present">
      <div class="stat-num">${presentCount}</div>
      <div class="stat-lbl">Present</div>
    </div>
    <div class="stat stat-absent">
      <div class="stat-num">${absentCount}</div>
      <div class="stat-lbl">Absent</div>
    </div>
    <div class="stat stat-total">
      <div class="stat-num">${total}</div>
      <div class="stat-lbl">Total</div>
    </div>
    <div class="stat stat-pct">
      <div class="stat-num">${pct}%</div>
      <div class="stat-lbl">Attendance</div>
    </div>
  </div>

  <!-- Progress bar -->
  <div class="progress-wrap">
    <div class="progress-label">
      <span>Attendance Rate</span>
      <span style="color:${pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'}">${pct}%</span>
    </div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  </div>

  <!-- Student Table -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Student Name</th>
          <th>Phone</th>
          <th style="text-align:center;">Status</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  ${absentStudents.length > 0 ? `
  <!-- Absentees -->
  <div class="absentees">
    <div class="section-title">Absentees (${absentCount})</div>
    <div class="absent-chips">
      ${absentStudents.map(s => `<div class="absent-chip">${s.name}</div>`).join('')}
    </div>
  </div>` : ''}

  <!-- Footer / Signature -->
  <div class="footer">
    <div class="footer-left">
      CoachPro · Attendance Report · ${formattedDate}
    </div>
    <div class="footer-right">
      <div class="sig-line">Teacher's Signature</div>
    </div>
  </div>

</div>
</body>
</html>`

  // Open in new tab → browser print dialog appears → user saves as PDF
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  // Small delay so styles render before print dialog opens
  setTimeout(() => {
    win.focus()
    win.print()
  }, 400)
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  const attendanceRef    = useRef<AttMap>({})
  const batchStudentsRef = useRef<Student[]>([])
  const dateRef          = useRef(date)

  attendanceRef.current    = attendance
  dateRef.current          = date
  const batchStudents      = students.filter(s => s.batch === selectedBatch)
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
      if (bRes.value.length > 0 && !currentBatch) {
        setSelectedBatch(bRes.value[0].name)
      }
    } else {
      show(`Could not load batches: ${extractError(bRes.reason)}`, 'error')
    }

    const map: AttMap = {}
    allStudents.forEach(s => { map[s.id] = 'present' })
    if (aRes.status === 'fulfilled') {
      aRes.value.forEach(r => { map[r.student_id] = r.status })
    }
    setAttendance(map)
    setLoading(false)
  }, [show])

  useEffect(() => {
    load(date, selectedBatch || undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

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

  // Save to DB → then generate PDF
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
      show('Attendance saved — generating PDF…', 'info')
      console.log('[Attendance] Saved successfully')

      // Generate PDF after successful save
      const batchInfo = batches.find(b => b.name === selectedBatch)
      generateAttendancePDF(
        selectedBatch,
        batchInfo?.timing ?? '',
        d,
        students,
        att,
      )
    } catch (e) {
      const msg = extractError(e)
      console.error('[Attendance] Save failed:', e)
      show(`Failed to save: ${msg}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Download PDF without saving (for already-saved records)
  const downloadPDF = () => {
    const batchInfo = batches.find(b => b.name === selectedBatch)
    generateAttendancePDF(
      selectedBatch,
      batchInfo?.timing ?? '',
      dateRef.current,
      batchStudentsRef.current,
      attendanceRef.current,
    )
  }

  const notifyAbsentees = () => {
    const abs = batchStudentsRef.current.filter(s => attendanceRef.current[s.id] === 'absent')
    if (!abs.length) { show('No absentees to notify 🎉', 'info'); return }
    const d = new Date(dateRef.current).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

    if (abs.length === 1) {
      const s   = abs[0]
      const msg = encodeURIComponent(`Dear ${s.name},\n\nYou were *absent* on ${d} for the ${s.batch} batch.\n\nPlease attend regularly.\n\n— CoachPro Institute`)
      window.open(`https://wa.me/91${s.phone}?text=${msg}`, '_blank')
      show('WhatsApp opened for absentee', 'info')
    } else {
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

          {/* ── Save + PDF Button ── */}
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
                <span className="spinner w-4 h-4" /> Saving & generating PDF…
              </span>
            ) : saved ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved & PDF Generated
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save & Download PDF
              </span>
            )}
          </button>

          {/* ── Re-download PDF after save ── */}
          {saved && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Changes saved · <button onClick={() => setSaved(false)} className="underline hover:text-slate-600">Make more changes</button>
              </p>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download PDF again
              </button>
            </div>
          )}
        </div>
      )}

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}