-- ============================================================
-- FIX SHIFT: Ganti Sore -> Malam
-- Jalankan SATU PER SATU di Supabase SQL Editor
-- ============================================================

-- STEP 1: Hapus constraint lama dulu (yang hanya izinkan Pagi/Siang/Sore)
ALTER TABLE absen_detail DROP CONSTRAINT IF EXISTS absen_detail_shift_check;
ALTER TABLE absen_session DROP CONSTRAINT IF EXISTS absen_session_shift_check;

-- STEP 2: Update data lama Sore -> Malam
UPDATE absen_detail SET shift = 'Malam' WHERE shift = 'Sore';
UPDATE absen_session SET shift = 'Malam' WHERE shift = 'Sore';

-- STEP 3: Tambah constraint baru dengan Malam
ALTER TABLE absen_detail
  ADD CONSTRAINT absen_detail_shift_check
  CHECK (shift IN ('Pagi','Siang','Malam'));

ALTER TABLE absen_session
  ADD CONSTRAINT absen_session_shift_check
  CHECK (shift IN ('Pagi','Siang','Malam'));

-- STEP 4: Verifikasi
SELECT 'absen_detail shift' as cek, shift, count(*) 
FROM absen_detail GROUP BY shift ORDER BY shift;
