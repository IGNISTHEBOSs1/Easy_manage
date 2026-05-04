import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getStudents, getBatches, getAttendanceByDate, upsertAttendance,
  extractError, type Student, type Batch,
} from '../lib/supabase'
import Toast, { useToast } from '../components/Toast'

type AttMap = Record<string, 'present' | 'absent'>

function generateAttendancePDF(
  batchName: string, batchTiming: string, date: string,
  students: Student[], attendance: AttMap,
) {
  const presentCount = students.filter(s => attendance[s.id] !== 'absent').length
  const absentCount  = students.length - presentCount
  const total        = students.length
  const pct          = total > 0 ? Math.round(presentCount / total * 100) : 0
  const formattedDate = new Date(date).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  const shortDate    = new Date(date).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' })
  const generatedAt  = new Date().toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  const rows = students.map((s, i) => {
    const isPresent = attendance[s.id] !== 'absent'
    const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb'
    return `<tr style="background:${bg}"><td class="td-num">${i+1}</td><td class="td-name">${s.name}</td><td class="td-phone">${s.phone}</td><td class="td-status"><span class="${isPresent?'badge-p':'badge-a'}">${isPresent?'P':'A'}</span></td><td class="td-sig"></td></tr>`
  }).join('')
  const absentNames = students.filter(s => attendance[s.id]==='absent').map(s => s.name).join(', ')
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Attendance — ${batchName} — ${shortDate}</title><style>*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}@page{size:A4 portrait;margin:12mm 14mm;}body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#0f172a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e293b;padding-bottom:7px;margin-bottom:8px;}.brand{display:flex;align-items:center;gap:8px;}.brand-icon{width:28px;height:28px;background:linear-gradient(135deg,#6366f1,#4338ca);border-radius:7px;display:flex;align-items:center;justify-content:center;}.brand-icon svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2;}.brand-name{font-size:15px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;}.brand-sub{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;}.report-info{text-align:right;}.report-title{font-size:14px;font-weight:800;color:#0f172a;}.report-date{font-size:10px;color:#64748b;margin-top:1px;}.meta-strip{display:flex;gap:6px;margin-bottom:8px;}.meta-pill{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:4px 10px;font-size:10px;color:#475569;}.meta-pill strong{color:#0f172a;font-weight:700;}.stats{display:flex;gap:6px;margin-bottom:10px;}.stat{flex:1;border-radius:7px;padding:6px 10px;display:flex;align-items:center;gap:8px;}.stat-p{background:#f0fdf4;border:1px solid #bbf7d0;}.stat-a{background:#fff1f2;border:1px solid #fecdd3;}.stat-t{background:#eff6ff;border:1px solid #bfdbfe;}.stat-r{background:#fffbeb;border:1px solid #fde68a;}.stat-num{font-size:20px;font-weight:800;line-height:1;}.stat-p .stat-num{color:#16a34a;}.stat-a .stat-num{color:#dc2626;}.stat-t .stat-num{color:#2563eb;}.stat-r .stat-num{color:#d97706;}.stat-lbl{font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;}.bar-wrap{margin-bottom:10px;}.bar-track{height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;}.bar-fill{height:6px;border-radius:99px;background:${pct>=80?'#22c55e':pct>=60?'#f59e0b':'#ef4444'};width:${pct}%;}.bar-label{display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;margin-bottom:3px;}.reg-wrap{border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:10px;}table{width:100%;border-collapse:collapse;}thead tr{background:#1e293b;}thead th{padding:6px 8px;text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;}thead th.th-status,thead th.th-sig{text-align:center;}td{border-bottom:1px solid #f1f5f9;vertical-align:middle;}.td-num{padding:4px 8px;width:30px;color:#94a3b8;font-size:10px;text-align:right;}.td-name{padding:4px 10px;font-weight:600;font-size:11px;color:#0f172a;width:35%;}.td-phone{padding:4px 8px;font-family:monospace;font-size:10px;color:#64748b;width:22%;}.td-status{padding:4px 8px;text-align:center;width:60px;}.td-sig{padding:4px 8px;width:90px;border-left:1px dashed #cbd5e1;}tr:last-child td{border-bottom:none;}.badge-p,.badge-a{display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;text-align:center;font-size:10px;font-weight:800;}.badge-p{background:#dcfce7;color:#15803d;}.badge-a{background:#fee2e2;color:#dc2626;}.absent-line{font-size:10px;color:#64748b;margin-bottom:12px;line-height:1.5;}.absent-line strong{color:#dc2626;}.footer{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:4px;}.footer-left{font-size:9px;color:#94a3b8;line-height:1.6;}.sig-block{text-align:center;}.sig-line{display:inline-block;min-width:140px;border-top:1px solid #334155;padding-top:4px;font-size:9px;color:#64748b;}@media print{body{padding:0;}.no-print{display:none!important;}}</style></head><body><div class="header"><div class="brand"><div class="brand-icon"><svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div><div><div class="brand-name">CoachPro</div><div class="brand-sub">Institute Manager</div></div></div><div class="report-info"><div class="report-title">Attendance Register</div><div class="report-date">${formattedDate}</div></div></div><div class="meta-strip"><div class="meta-pill"><strong>Batch:</strong> ${batchName}${batchTiming?` &nbsp;·&nbsp; ${batchTiming}`:''}</div><div class="meta-pill"><strong>Date:</strong> ${shortDate}</div><div class="meta-pill"><strong>Generated:</strong> ${generatedAt}</div></div><div class="stats"><div class="stat stat-p"><div class="stat-num">${presentCount}</div><div class="stat-lbl">Present</div></div><div class="stat stat-a"><div class="stat-num">${absentCount}</div><div class="stat-lbl">Absent</div></div><div class="stat stat-t"><div class="stat-num">${total}</div><div class="stat-lbl">Total</div></div><div class="stat stat-r"><div class="stat-num">${pct}%</div><div class="stat-lbl">Rate</div></div></div><div class="bar-wrap"><div class="bar-label"><span>Attendance Rate</span><span>${pct}%</span></div><div class="bar-track"><div class="bar-fill"></div></div></div><div class="reg-wrap"><table><thead><tr><th>#</th><th>Student Name</th><th>Phone</th><th class="th-status">Status</th><th class="th-sig">Student Signature</th></tr></thead><tbody>${rows}</tbody></table></div>${absentCount>0?`<div class="absent-line"><strong>Absent (${absentCount}):</strong> ${absentNames}</div>`:`<div class="absent-line" style="color:#16a34a;">✓ <strong style="color:#16a34a;">Full attendance</strong> — all ${total} students present.</div>`}<div class="footer"><div class="footer-left">CoachPro Institute Manager &nbsp;·&nbsp; ${batchName} &nbsp;·&nbsp; ${shortDate}<br/>P = Present &nbsp; A = Absent &nbsp;·&nbsp; Generated: ${generatedAt}</div><div class="sig-block"><div class="sig-line">Teacher / Instructor Signature</div></div></div></body></html>`
  const win = window.open('', '_blank')
  if (!win) { alert('Popup blocked — please allow popups for this site and try again.'); return }
  win.document.write(html); win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 350)
}

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
  const batchStudents      = students.filter(s => (s.batches?.name ?? s.batch_name_legacy) === selectedBatch)
  batchStudentsRef.current = batchStudents
  const isToday = date === new Date().toISOString().split('T')[0]

  const load = useCallback(async (currentDate: string, currentBatch?: string) => {
    setLoading(true); setSaved(false)
    const [sRes, bRes, aRes] = await Promise.allSettled([getStudents(), getBatches(), getAttendanceByDate(currentDate)])
    let allStudents: Student[] = []
    if (sRes.status === 'fulfilled') { allStudents = sRes.value; setStudents(sRes.value) }
    else show(`Could not load students: ${extractError(sRes.reason)}`, 'error')
    if (bRes.status === 'fulfilled') {
      setBatches(bRes.value)
      if (bRes.value.length > 0 && !currentBatch) setSelectedBatch(bRes.value[0].name)
    } else show(`Could not load batches: ${extractError(bRes.reason)}`, 'error')
    const map: AttMap = {}
    allStudents.forEach(s => { map[s.id] = 'present' })
    if (aRes.status === 'fulfilled') aRes.value.forEach(r => { map[r.student_id] = r.status })
    setAttendance(map); setLoading(false)
  }, [show])

  useEffect(() => { load(date, selectedBatch || undefined) }, [date]) // eslint-disable-line
  useEffect(() => { load(date) }, [])                                  // eslint-disable-line

  const toggle  = (id: string) => { setSaved(false); setAttendance(a => ({ ...a, [id]: a[id]==='present'?'absent':'present' })) }
  const allPre  = () => { setSaved(false); setAttendance(a => { const u={...a}; batchStudentsRef.current.forEach(s=>{u[s.id]='present'}); return u }) }
  const allAbs  = () => { setSaved(false); setAttendance(a => { const u={...a}; batchStudentsRef.current.forEach(s=>{u[s.id]='absent'}); return u }) }

  const triggerPDF = () => {
    const batchInfo = batches.find(b => b.name === selectedBatch)
    generateAttendancePDF(selectedBatch, batchInfo?.timing ?? '', dateRef.current, batchStudentsRef.current, attendanceRef.current)
  }

  const save = async () => {
    const sts = batchStudentsRef.current, att = attendanceRef.current, d = dateRef.current
    if (!sts.length) { show('No students in this batch', 'error'); return }
    setSaving(true); setSaved(false)
    const records = sts.map(s => ({ student_id: s.id, date: d, status: att[s.id] ?? 'present' }))
    try {
      await upsertAttendance(records); setSaved(true); show('Saved — opening PDF…', 'info'); triggerPDF()
    } catch(e) { show(`Failed to save: ${extractError(e)}`, 'error') }
    finally { setSaving(false) }
  }

  const notifyAbsentees = () => {
    const abs = batchStudentsRef.current.filter(s => attendanceRef.current[s.id]==='absent')
    if (!abs.length) { show('No absentees to notify 🎉', 'info'); return }
    const d = new Date(dateRef.current).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })
    const first = abs[0]
    const msg = encodeURIComponent(`Dear ${first.name},\n\nYou were *absent* on ${d} for the ${first.batches?.name ?? first.batch_name_legacy} batch.\n\nPlease attend regularly.\n\n— CoachPro Institute`)
    window.open(`https://wa.me/91${first.phone}?text=${msg}`, '_blank')
    if (abs.length > 1) show(`Opened WhatsApp for ${first.name}. ${abs.length-1} more — click again.`, 'info')
    else show('WhatsApp opened for absentee', 'info')
  }

  const presentCount = batchStudents.filter(s => attendance[s.id] !== 'absent').length
  const absentCount  = batchStudents.length - presentCount
  const pct          = batchStudents.length > 0 ? Math.round(presentCount/batchStudents.length*100) : 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Attendance</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {batchStudents.length > 0 ? `${selectedBatch} · ${presentCount}/${batchStudents.length} present · ${pct}%` : 'Select a batch to begin'}
        </p>
      </div>

      {/* Date + Batch */}
      <div className="card p-4 space-y-4">
        <div>
          <label className="label">Date</label>
          <div className="flex gap-2">
            <input className="input flex-1" type="date" value={date} max={new Date().toISOString().split('T')[0]} onChange={e => setDate(e.target.value)} />
            {!isToday && <button onClick={() => setDate(new Date().toISOString().split('T')[0])} className="btn-secondary shrink-0 text-xs">Today</button>}
          </div>
        </div>
        {batches.length > 0 && (
          <div>
            <label className="label">Batch</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {batches.map(b => {
                const cnt = students.filter(s => s.batch_id === b.id).length
                return (
                  <button key={b.id} onClick={() => { setSaved(false); setSelectedBatch(b.name) }}
                    className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all text-left ${
                      selectedBatch===b.name
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}>
                    <span className="block truncate">{b.name}</span>
                    <span className={`text-[10px] font-medium ${selectedBatch===b.name?'text-brand-200':'text-slate-400 dark:text-slate-500'}`}>
                      {b.timing || `${cnt} student${cnt!==1?'s':''}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {batches.length === 0 && !loading && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">No batches found. Go to Students page to create batches first.</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {batchStudents.length > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance Rate</span>
            <span className={`text-sm font-bold ${pct>=80?'text-emerald-600':pct>=60?'text-amber-500':'text-red-500'}`}>{pct}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${pct>=80?'bg-emerald-500':pct>=60?'bg-amber-400':'bg-red-400'}`} style={{ width:`${pct}%` }} />
          </div>
          <div className="flex gap-5 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{presentCount} Present</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400"/><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{absentCount} Absent</span></div>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {batchStudents.length > 0 && (
        <div className="flex gap-2">
          <button onClick={allPre} className="btn-secondary flex-1 text-xs py-2">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            All Present
          </button>
          <button onClick={allAbs} className="btn-secondary flex-1 text-xs py-2">
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            All Absent
          </button>
          <button onClick={notifyAbsentees} disabled={absentCount===0} className="btn-warning flex-1 text-xs py-2">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
            Notify ({absentCount})
          </button>
        </div>
      )}

      {/* Student cards */}
      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-brand-400"/></div>
      ) : batchStudents.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {students.length===0 ? 'No students yet' : `No students in ${selectedBatch||'this batch'}`}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {students.length===0 ? 'Add students from the Students page first.' : 'Add students to this batch from the Students page.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tap to toggle present / absent</p>
          <div className="space-y-2">
            {batchStudents.map(s => {
              const isPresent = attendance[s.id] !== 'absent'
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  className={`w-full card p-3.5 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98] ${
                    isPresent
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      : 'border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}>
                  <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${isPresent?'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400':'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{s.phone}</p>
                  </div>
                  <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${isPresent?'bg-emerald-500 text-white':'bg-red-400 text-white'}`}>
                    {isPresent
                      ? <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> P</>
                      : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg> A</>
                    }
                  </div>
                </button>
              )
            })}
          </div>

          {/* Save + PDF */}
          <button onClick={save} disabled={saving||saved}
            className={`w-full py-3.5 font-semibold text-sm rounded-xl transition-all ${saved?'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default':'btn-primary'}`}>
            {saving ? (
              <span className="flex items-center justify-center gap-2"><span className="spinner w-4 h-4"/> Saving…</span>
            ) : saved ? (
              <span className="flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> Saved</span>
            ) : (
              <span className="flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg> Save & Download PDF</span>
            )}
          </button>
          {saved && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 dark:text-slate-500">Saved · <button onClick={() => setSaved(false)} className="underline hover:text-slate-600 dark:hover:text-slate-300">Edit</button></p>
              <button onClick={triggerPDF} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Download PDF again
              </button>
            </div>
          )}
        </div>
      )}

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hide}/>}
    </div>
  )
}
