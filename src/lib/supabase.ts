import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = 'https://xzhjdpuzhqjvhgikccjt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aGpkcHV6aHFqdmhnaWtjY2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTk4MzYsImV4cCI6MjA5MDk3NTgzNn0.u4YQoK4LvTviCJShX1tH1MVpAlS9n7iQMHv27fh86Kk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HELPER
// ─────────────────────────────────────────────────────────────────────────────

export function extractError(err: unknown): string {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message) return e.message
    if (typeof e.error === 'string') return e.error
  }
  return 'Unknown error'
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION CHECK
// ─────────────────────────────────────────────────────────────────────────────

export async function checkConnection(): Promise<string | null> {
  try {
    const { error } = await supabase.from('students').select('id').limit(1)
    if (error) return extractError(error)
    return null
  } catch (e) {
    return extractError(e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — match DB schema after Checkpoint 1 migrations
// ─────────────────────────────────────────────────────────────────────────────

export interface Batch {
  id:         string
  name:       string
  timing:     string
  created_at: string
}

// students.batch TEXT was migrated to batch_id UUID FK.
// batch_name_legacy keeps the old text value for display fallback.
// batches? is populated when fetched with select('*, batches(...)').
export interface Student {
  id:                string
  name:              string
  phone:             string
  batch_id:          string
  batch_name_legacy: string
  created_at:        string
  batches?:          Pick<Batch, 'id' | 'name' | 'timing'>
}

// fees.amount renamed to total_amount; status widened to 4 states.
export type FeeStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface Fee {
  id:              string
  student_id:      string
  organization_id: string | null
  total_amount:    number
  status:          FeeStatus
  due_date:        string
  created_at:      string
  students?:       Pick<Student, 'id' | 'name' | 'phone' | 'batch_id' | 'batch_name_legacy'>
}

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other'

export interface Payment {
  id:              string
  fee_id:          string
  organization_id: string | null
  amount:          number
  payment_date:    string
  method:          PaymentMethod
  notes:           string | null
  created_at:      string
}

export type AdjustmentType = 'late_fee' | 'discount' | 'waiver'

export interface FeeAdjustment {
  id:              string
  fee_id:          string
  organization_id: string | null
  type:            AdjustmentType
  amount:          number
  reason:          string | null
  applied_by:      string | null
  created_at:      string
}

export interface RecurringFeeRule {
  id:              string
  organization_id: string | null
  batch_id:        string
  amount:          number
  due_day:         number
  start_date:      string
  end_date:        string | null
  active:          boolean
  created_at:      string
  batches?:        Pick<Batch, 'id' | 'name'>
}

export interface LateFeeRule {
  id:              string
  organization_id: string | null
  type:            'fixed' | 'percentage'
  value:           number
  grace_days:      number
  max_limit:       number | null
  active:          boolean
  created_at:      string
}

export interface Attendance {
  id:         string
  student_id: string
  date:       string
  status:     'present' | 'absent'
  students?:  Pick<Student, 'id' | 'name' | 'phone' | 'batch_id' | 'batch_name_legacy'>
}

// ─── RPC return types ─────────────────────────────────────────────────────────

export interface FeeBalance {
  fee_id:            string
  student_id:        string
  total_amount:      number
  total_paid:        number
  late_fee_amount:   number
  total_adjustments: number
  balance_due:       number
  effective_status:  FeeStatus
  due_date:          string
}

export interface PaymentResult {
  payment_id:     string
  fee_id:         string
  amount_paid:    number
  new_fee_status: FeeStatus
  balance_due:    number
}

export interface PendingReminder {
  student_id:   string
  student_name: string
  phone:        string
  fee_id:       string
  total_amount: number
  balance_due:  number
  late_fee:     number
  due_date:     string
  days_overdue: number
  status:       FeeStatus
}

export interface BatchFeeSummary {
  batch_id:        string
  batch_name:      string
  total_students:  number
  total_fees:      number
  total_collected: number
  total_pending:   number
  total_overdue:   number
  collection_rate: number
}

export interface LateFeeResult {
  fee_id:          string
  late_fee_amount: number
  was_applied:     boolean
  reason:          string
}

export interface BulkAttendanceResult {
  inserted: number
  updated:  number
  failed:   number
}

export interface RecurringFeeResult {
  rule_id:      string
  batch_name:   string
  fees_created: number
  fees_skipped: number
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCHES
// ─────────────────────────────────────────────────────────────────────────────

export const getBatches = async (): Promise<Batch[]> => {
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const addBatch = async (
  batch: Pick<Batch, 'name' | 'timing'>
): Promise<Batch> => {
  const { data, error } = await supabase
    .from('batches')
    .insert(batch)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteBatch = async (id: string): Promise<void> => {
  const { error } = await supabase.from('batches').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENTS
// batch_id (UUID FK) replaces the old batch TEXT column.
// When inserting, pass batch_id. batch_name_legacy is kept in sync for display.
// ─────────────────────────────────────────────────────────────────────────────

export const getStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('*, batches(id, name, timing)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const getStudentsByBatch = async (batchId: string): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('*, batches(id, name, timing)')
    .eq('batch_id', batchId)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const addStudent = async (
  student: Pick<Student, 'name' | 'phone' | 'batch_id'>
): Promise<Student> => {
  // Fetch batch name to keep batch_name_legacy in sync
  const { data: batch, error: be } = await supabase
    .from('batches')
    .select('name')
    .eq('id', student.batch_id)
    .single()
  if (be) throw be

  const { data, error } = await supabase
    .from('students')
    .insert({
      name:              student.name,
      phone:             student.phone,
      batch_id:          student.batch_id,
      batch_name_legacy: batch.name,
    })
    .select('*, batches(id, name, timing)')
    .single()
  if (error) throw error
  return data
}

export const deleteStudent = async (id: string): Promise<void> => {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// FEES
// ─────────────────────────────────────────────────────────────────────────────

export const getFees = async (): Promise<Fee[]> => {
  const { data, error } = await supabase
    .from('fees')
    .select('*, students(id, name, phone, batch_id, batch_name_legacy)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const getPendingFees = async (): Promise<Fee[]> => {
  const { data, error } = await supabase
    .from('fees')
    .select('*, students(id, name, phone, batch_id, batch_name_legacy)')
    .in('status', ['pending', 'partial', 'overdue'])
    .order('due_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const getFeesByStudent = async (studentId: string): Promise<Fee[]> => {
  const { data, error } = await supabase
    .from('fees')
    .select('*, students(id, name, phone, batch_id, batch_name_legacy)')
    .eq('student_id', studentId)
    .order('due_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const addFee = async (
  fee: Pick<Fee, 'student_id' | 'total_amount' | 'due_date'>
): Promise<Fee> => {
  const { data, error } = await supabase
    .from('fees')
    .insert({ student_id: fee.student_id, total_amount: fee.total_amount, due_date: fee.due_date, status: 'pending' })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Legacy direct status update — used by "Mark Paid" button.
 *  For new code prefer recordPayment() which also inserts a payment record. */
export const updateFeeStatus = async (id: string, status: FeeStatus): Promise<void> => {
  const { error } = await supabase.from('fees').update({ status }).eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS (Checkpoint 1 — partial payment support)
// ─────────────────────────────────────────────────────────────────────────────

/** get_fee_balance — single source of truth for what a student owes */
export const getFeeBalance = async (feeId: string): Promise<FeeBalance> => {
  const { data, error } = await supabase.rpc('get_fee_balance', { p_fee_id: feeId })
  if (error) throw error
  if (!data || data.length === 0) throw new Error(`Fee ${feeId} not found`)
  return data[0] as FeeBalance
}

/** record_payment — row-locked, rejects overpayment, syncs fee status */
export const recordPayment = async (
  feeId:  string,
  amount: number,
  method: PaymentMethod = 'cash',
  notes?: string,
): Promise<PaymentResult> => {
  const { data, error } = await supabase.rpc('record_payment', {
    p_fee_id: feeId, p_amount: amount, p_method: method, p_notes: notes ?? null,
  })
  if (error) throw error
  return data[0] as PaymentResult
}

export const getPaymentsByFee = async (feeId: string): Promise<Payment[]> => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('fee_id', feeId)
    .order('payment_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// LATE FEES
// ─────────────────────────────────────────────────────────────────────────────

export const getActiveLateFeeRule = async (): Promise<LateFeeRule | null> => {
  const { data, error } = await supabase
    .from('late_fee_rules')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export const upsertLateFeeRule = async (
  rule: Pick<LateFeeRule, 'type' | 'value' | 'grace_days' | 'max_limit'>
): Promise<LateFeeRule> => {
  await supabase.from('late_fee_rules').update({ active: false }).eq('active', true)
  const { data, error } = await supabase
    .from('late_fee_rules')
    .insert({ ...rule, active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export const applyLateFee = async (feeId: string): Promise<LateFeeResult> => {
  const { data, error } = await supabase.rpc('apply_late_fee', { p_fee_id: feeId })
  if (error) throw error
  return data[0] as LateFeeResult
}

export const bulkApplyLateFees = async (): Promise<{ processed: number; applied: number; skipped: number }> => {
  const { data, error } = await supabase.rpc('bulk_apply_late_fees')
  if (error) throw error
  return data[0]
}

export const getFeeAdjustments = async (feeId: string): Promise<FeeAdjustment[]> => {
  const { data, error } = await supabase
    .from('fee_adjustments')
    .select('*')
    .eq('fee_id', feeId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING FEE RULES
// ─────────────────────────────────────────────────────────────────────────────

export const getRecurringRules = async (): Promise<RecurringFeeRule[]> => {
  const { data, error } = await supabase
    .from('recurring_fee_rules')
    .select('*, batches(id, name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const getActiveRecurringRule = async (batchId: string): Promise<RecurringFeeRule | null> => {
  const { data, error } = await supabase
    .from('recurring_fee_rules')
    .select('*, batches(id, name)')
    .eq('batch_id', batchId)
    .eq('active', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export const createRecurringRule = async (
  rule: Pick<RecurringFeeRule, 'batch_id' | 'amount' | 'due_day' | 'start_date' | 'end_date'>
): Promise<RecurringFeeRule> => {
  const { data, error } = await supabase
    .from('recurring_fee_rules')
    .insert({ ...rule, active: true })
    .select('*, batches(id, name)')
    .single()
  if (error) throw error
  return data
}

export const deactivateRecurringRule = async (id: string): Promise<void> => {
  const { error } = await supabase.from('recurring_fee_rules').update({ active: false }).eq('id', id)
  if (error) throw error
}

export const generateRecurringFees = async (year: number, month: number): Promise<RecurringFeeResult[]> => {
  const { data, error } = await supabase.rpc('generate_recurring_fees', {
    p_target_year: year, p_target_month: month,
  })
  if (error) throw error
  return (data ?? []) as RecurringFeeResult[]
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Server-side atomic attendance upsert — replaces fragile client loop */
export const bulkMarkAttendance = async (
  records: Array<{ student_id: string; date: string; status: 'present' | 'absent' }>
): Promise<BulkAttendanceResult> => {
  const { data, error } = await supabase.rpc('bulk_mark_attendance', { p_records: records })
  if (error) throw error
  return data[0] as BulkAttendanceResult
}

/** All students with pending balances + contact info for bulk reminders */
export const getPendingReminders = async (): Promise<PendingReminder[]> => {
  const { data, error } = await supabase.rpc('get_pending_reminders')
  if (error) throw error
  return (data ?? []) as PendingReminder[]
}

/** Fee collection summary per batch for dashboard */
export const getBatchFeeSummary = async (batchId?: string): Promise<BatchFeeSummary[]> => {
  const { data, error } = await supabase.rpc('get_batch_fee_summary', { p_batch_id: batchId ?? null })
  if (error) throw error
  return (data ?? []) as BatchFeeSummary[]
}

/** Recalculate and sync status for all non-paid fees — run nightly */
export const syncAllFeeStatuses = async (): Promise<{ fees_updated: number; fees_checked: number }> => {
  const { data, error } = await supabase.rpc('sync_all_fee_statuses')
  if (error) throw error
  return data[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

export const getTodayAttendance = async (): Promise<Attendance[]> => {
  const today = new Date().toISOString().split('T')[0]
  return getAttendanceByDate(today)
}

export const getAttendanceByDate = async (date: string): Promise<Attendance[]> => {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, students(id, name, phone, batch_id, batch_name_legacy)')
    .eq('date', date)
  if (error) throw error
  return data ?? []
}

/** Original upsert kept for Attendance page backward compat.
 *  New code should prefer bulkMarkAttendance() which goes via DB function. */
export const upsertAttendance = async (
  records: Array<{ student_id: string; date: string; status: 'present' | 'absent' }>
): Promise<void> => {
  const { error } = await supabase
    .from('attendance')
    .upsert(records, { onConflict: 'student_id,date' })
  if (error) throw error
}
