-- ============================================================
-- FIX DATABASE — Jalankan di Supabase SQL Editor
-- ============================================================

-- STEP 1: Hapus data duplikat absen_detail dulu
-- (Simpan hanya 1 record per WBP per hari — ambil yang paling baru)
DELETE FROM absen_detail
WHERE id NOT IN (
  SELECT DISTINCT ON (wbp_id, tanggal) id
  FROM absen_detail
  ORDER BY wbp_id, tanggal, created_at DESC
);

-- STEP 2: Buat unique index (setelah duplikat dihapus)
DROP INDEX IF EXISTS idx_absen_wbp_hari;
CREATE UNIQUE INDEX idx_absen_wbp_hari ON absen_detail(wbp_id, tanggal);

-- STEP 3: Fix absen_session — hapus constraint lama jika ada
DROP INDEX IF EXISTS idx_sesi_aktif;
CREATE UNIQUE INDEX idx_sesi_aktif ON absen_session(blok_id, tanggal) WHERE selesai = false;

-- STEP 4: Hapus kolom status dari absen_session jika masih ada (pakai kolom selesai boolean)
-- ALTER TABLE absen_session DROP COLUMN IF EXISTS status;

-- STEP 5: Pastikan kolom selesai ada
ALTER TABLE absen_session ADD COLUMN IF NOT EXISTS selesai boolean DEFAULT false;

-- Verifikasi
SELECT 'absen_detail rows' as info, count(*) FROM absen_detail
UNION ALL
SELECT 'absen_session rows', count(*) FROM absen_session;
