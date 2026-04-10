-- ============================================================
-- CoachPro v2 — Run this in Supabase SQL Editor → New Query
-- ============================================================

-- 1. Batches (dynamic, user-created)
CREATE TABLE IF NOT EXISTS batches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  timing     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Students
CREATE TABLE IF NOT EXISTS students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  batch      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Fees
CREATE TABLE IF NOT EXISTS fees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','pending')),
  due_date   DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent')),
  CONSTRAINT attendance_student_date_unique UNIQUE (student_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fees_student_id    ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_status        ON fees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

-- Disable RLS (single-institute MVP)
ALTER TABLE batches    DISABLE ROW LEVEL SECURITY;
ALTER TABLE students   DISABLE ROW LEVEL SECURITY;
ALTER TABLE fees       DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;

-- Grant anon role full access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

-- Optional: seed starter batches (remove if you want to start fresh)
-- INSERT INTO batches (name, timing) VALUES
--   ('Morning',   '7–9am'),
--   ('Afternoon', '12–2pm'),
--   ('Evening',   '5–7pm'),
--   ('Weekend',   'Sat–Sun')
-- ON CONFLICT (name) DO NOTHING;
