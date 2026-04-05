-- ============================================================
-- CoachPro — Supabase SQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Students
CREATE TABLE IF NOT EXISTS students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  batch      TEXT NOT NULL CHECK (batch IN ('Morning', 'Afternoon', 'Evening', 'Weekend')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Fees
CREATE TABLE IF NOT EXISTS fees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
  due_date   DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Attendance (unique per student per day)
CREATE TABLE IF NOT EXISTS attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  CONSTRAINT attendance_student_date_unique UNIQUE (student_id, date)
);

-- ── Indexes for performance ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_status     ON fees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);

-- ── Disable RLS (MVP — no multi-tenant auth yet) ───────────
-- Enable these when you add authentication in v2
ALTER TABLE students   DISABLE ROW LEVEL SECURITY;
ALTER TABLE fees       DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;

-- ── Optional: Seed sample data ────────────────────────────
-- Uncomment to add test students
/*
INSERT INTO students (name, phone, batch) VALUES
  ('Arjun Sharma',   '9876543210', 'Morning'),
  ('Priya Verma',    '9876543211', 'Morning'),
  ('Rahul Singh',    '9876543212', 'Afternoon'),
  ('Sneha Patel',    '9876543213', 'Afternoon'),
  ('Vikram Joshi',   '9876543214', 'Evening'),
  ('Anjali Gupta',   '9876543215', 'Evening'),
  ('Karan Mehta',    '9876543216', 'Weekend'),
  ('Pooja Yadav',    '9876543217', 'Weekend');
*/
