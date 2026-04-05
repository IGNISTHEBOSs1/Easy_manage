import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Student {
  id: string
  name: string
  phone: string
  batch: string
  created_at: string
}

export interface Fee {
  id: string
  student_id: string
  amount: number
  status: 'paid' | 'pending'
  due_date: string
  created_at: string
  students?: Student
}

export interface Attendance {
  id: string
  student_id: string
  date: string
  status: 'present' | 'absent'
  students?: Student
}

// ─── Students ────────────────────────────────────────────────────────────────

export const getStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const addStudent = async (
  student: Omit<Student, 'id' | 'created_at'>
): Promise<Student> => {
  const { data, error } = await supabase
    .from('students')
    .insert(student)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteStudent = async (id: string): Promise<void> => {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}

// ─── Fees ────────────────────────────────────────────────────────────────────

export const getFees = async (): Promise<Fee[]> => {
  const { data, error } = await supabase
    .from('fees')
    .select('*, students(name, phone, batch)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const getPendingFees = async (): Promise<Fee[]> => {
  const { data, error } = await supabase
    .from('fees')
    .select('*, students(name, phone, batch)')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const addFee = async (
  fee: Omit<Fee, 'id' | 'created_at' | 'students'>
): Promise<Fee> => {
  const { data, error } = await supabase
    .from('fees')
    .insert(fee)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateFeeStatus = async (
  id: string,
  status: 'paid' | 'pending'
): Promise<void> => {
  const { error } = await supabase.from('fees').update({ status }).eq('id', id)
  if (error) throw error
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export const getTodayAttendance = async (): Promise<Attendance[]> => {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('attendance')
    .select('*, students(name, phone, batch)')
    .eq('date', today)
  if (error) throw error
  return data ?? []
}

export const getAttendanceByDate = async (date: string): Promise<Attendance[]> => {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, students(name, phone, batch)')
    .eq('date', date)
  if (error) throw error
  return data ?? []
}

export const upsertAttendance = async (
  records: Omit<Attendance, 'id' | 'students'>[]
): Promise<void> => {
  const { error } = await supabase
    .from('attendance')
    .upsert(records, { onConflict: 'student_id,date' })
  if (error) throw error
}
