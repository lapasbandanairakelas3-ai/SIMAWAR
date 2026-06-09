-- ============================================================
-- FIX v9 PWA — Cascade delete WBP + Email untuk admin
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Hapus FK lama (jika ada) dan buat ulang dengan CASCADE
ALTER TABLE absen_detail DROP CONSTRAINT IF EXISTS absen_detail_wbp_id_fkey;
ALTER TABLE absen_detail
  ADD CONSTRAINT absen_detail_wbp_id_fkey
  FOREIGN KEY (wbp_id) REFERENCES wbp(id) ON DELETE CASCADE;

-- 2. Tambah kolom email di pegawai (untuk lupa password admin)
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS email text;

-- Verifikasi
SELECT 'cascade ok' as cek, conname FROM pg_constraint 
WHERE conname = 'absen_detail_wbp_id_fkey';
SELECT 'email col ok' as cek, column_name FROM information_schema.columns 
WHERE table_name='pegawai' AND column_name='email';
