import type { Fee, Expense, Attendance } from '../lib/supabase'
import { getDefaulterData } from './defaulterService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeeInput {
  id:           string
  total_amount: number
  status:       Fee['status']
  due_date:     string
  student_id:   string
  paid_amount?: number
}

interface AttendanceInput {
  student_id: string
  status:     Attendance['status']
}

interface ExpenseInput {
  category: string
  amount:   number
}

interface InsightInput {
  fees:       FeeInput[]
  expenses:   ExpenseInput[]
  attendance: AttendanceInput[]
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** O(n) top-category finder using a hash map — no sort on full dataset */
function getTopExpenseCategory(expenses: ExpenseInput[]): string | null {
  if (!expenses.length) return null
  const totals: Record<string, number> = {}
  for (const exp of expenses) {
    totals[exp.category] = (totals[exp.category] ?? 0) + Number(exp.amount)
  }
  let topCat = '', topVal = 0
  for (const [cat, val] of Object.entries(totals)) {
    if (val > topVal) { topCat = cat; topVal = val }
  }
  return topCat || null
}

/** O(n) attendance rate per student using hash maps */
function getLowAttendanceStudentIds(
  attendance: AttendanceInput[],
  threshold  = 0.6,
): string[] {
  const total:   Record<string, number> = {}
  const present: Record<string, number> = {}

  for (const rec of attendance) {
    total[rec.student_id]   = (total[rec.student_id]   ?? 0) + 1
    if (rec.status === 'present')
      present[rec.student_id] = (present[rec.student_id] ?? 0) + 1
  }

  const low: string[] = []
  for (const [sid, count] of Object.entries(total)) {
    const rate = (present[sid] ?? 0) / count
    if (rate < threshold) low.push(sid)
  }
  return low
}

// ─── Core export ─────────────────────────────────────────────────────────────

/**
 * generateInsights
 *
 * Pure function. Single pass per dataset. Returns human-readable insight strings.
 * Designed to be extended per-tenant without schema changes.
 *
 * @param input  - fees, expenses, attendance records
 * @param today  - caller-supplied Date (compute once, reuse)
 */
export function generateInsights(
  input: InsightInput,
  today: Date = new Date(),
): string[] {
  const insights: string[] = []
  const { fees, expenses, attendance } = input

  // ── Defaulter count — O(n) single pass ──────────────────────────────────────
  let defaulterCount = 0
  let highRiskCount  = 0
  for (const fee of fees) {
    const d = getDefaulterData(fee, today)
    if (d.isOverdue) {
      defaulterCount++
      if (d.riskLevel === 'high') highRiskCount++
    }
  }
  if (defaulterCount > 0) {
    insights.push(
      `${defaulterCount} student${defaulterCount !== 1 ? 's have' : ' has'} overdue fees`
    )
  }
  if (highRiskCount > 0) {
    insights.push(
      `${highRiskCount} student${highRiskCount !== 1 ? 's are' : ' is'} high risk (30+ days overdue)`
    )
  }

  // ── Top expense category — O(n) hash map ────────────────────────────────────
  const topCategory = getTopExpenseCategory(expenses)
  if (topCategory) {
    insights.push(`Highest expense category: ${topCategory}`)
  }

  // ── Low attendance — O(n) hash map ──────────────────────────────────────────
  const lowAttendanceIds = getLowAttendanceStudentIds(attendance)
  if (lowAttendanceIds.length > 0) {
    insights.push(
      `${lowAttendanceIds.length} student${lowAttendanceIds.length !== 1 ? 's have' : ' has'} attendance below 60%`
    )
  }

  if (insights.length === 0) {
    insights.push('All fees collected, attendance healthy, expenses normal.')
  }

  return insights
}
