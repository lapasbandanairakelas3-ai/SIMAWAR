-- ============================================================
-- FIX COMPLETE v9 — Jalankan SEMUA sekaligus di SQL Editor
-- ============================================================

-- 1. Hapus constraint shift lama
ALTER TABLE absen_detail DROP CONSTRAINT IF EXISTS absen_detail_shift_check;
ALTER TABLE absen_session DROP CONSTRAINT IF EXISTS absen_session_shift_check;

-- 2. Update data Sore -> Malam
UPDATE absen_detail SET shift = 'Malam' WHERE shift = 'Sore';
UPDATE absen_session SET shift = 'Malam' WHERE shift = 'Sore';

-- 3. Constraint baru dengan Malam
ALTER TABLE absen_detail
  ADD CONSTRAINT absen_detail_shift_check
  CHECK (shift IN ('Pagi','Siang','Malam'));

-- 4. Hapus constraint status yang mungkin masih ada
ALTER TABLE absen_detail DROP CONSTRAINT IF EXISTS absen_detail_status_check;

-- 5. Update status Hadir -> Ada
UPDATE absen_detail SET status = 'Ada' WHERE status = 'Hadir';

-- 6. Buat tabel status_absen
CREATE TABLE IF NOT EXISTS status_absen (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nama       text NOT NULL UNIQUE,
  urutan     int DEFAULT 0,
  aktif      boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 7. Insert default status
INSERT INTO status_absen (nama, urutan) VALUES
  ('Ada',            1),
  ('Di Bengkel',     2),
  ('Di Kebun',       3),
  ('Di Rumah Sakit', 4)
ON CONFLICT (nama) DO NOTHING;

-- 8. RLS untuk status_absen
ALTER TABLE status_absen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_sa" ON status_absen;
CREATE POLICY "p_sa" ON status_absen FOR ALL USING (true) WITH CHECK (true);

-- 9. Verifikasi
SELECT 'shift values' as cek, shift, count(*) FROM absen_detail GROUP BY shift;
SELECT 'status values' as cek, status, count(*) FROM absen_detail GROUP BY status;
SELECT 'status_absen rows' as cek, nama FROM status_absen ORDER BY urutan;
