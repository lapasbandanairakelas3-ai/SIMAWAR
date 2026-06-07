-- ============================================================
-- FIX DATABASE v8 — Jalankan SATU PER SATU di SQL Editor
-- ============================================================

-- ── STEP 1: Tambah kolom is_admin ───────────────────────────
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- ── STEP 2: Migrasi role → is_admin (jika kolom role masih ada) ──
-- Cek dulu apakah kolom role masih ada:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='pegawai' AND column_name='role'
  ) THEN
    UPDATE pegawai SET is_admin = (role = 'admin');
    ALTER TABLE pegawai DROP COLUMN role;
    RAISE NOTICE 'Kolom role berhasil dihapus dan dimigrasikan ke is_admin';
  ELSE
    RAISE NOTICE 'Kolom role tidak ada (sudah dihapus sebelumnya)';
  END IF;
END $$;

-- ── STEP 3: Set admin berdasarkan username ───────────────────
-- Ganti 'admin' jika username admin Anda berbeda
UPDATE pegawai SET is_admin = true WHERE username = 'admin';

-- Verifikasi:
SELECT id, nama, username, is_admin FROM pegawai ORDER BY is_admin DESC;

-- ── STEP 4: Tambah kolom shift ke absen_detail ──────────────
ALTER TABLE absen_detail ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi';
UPDATE absen_detail SET shift = 'Pagi' WHERE shift IS NULL;

-- Hapus constraint lama (jika error "already exists") lalu buat baru:
DO $$
BEGIN
  ALTER TABLE absen_detail 
    ADD CONSTRAINT absen_detail_shift_check 
    CHECK (shift IN ('Pagi','Siang','Sore'));
  RAISE NOTICE 'Constraint shift berhasil dibuat';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint shift sudah ada, tidak perlu dibuat ulang';
END $$;

-- ── STEP 5: Tambah kolom shift ke absen_session ─────────────
ALTER TABLE absen_session ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi';
UPDATE absen_session SET shift = 'Pagi' WHERE shift IS NULL;

-- ── STEP 6: Rebuild unique indexes ──────────────────────────
DROP INDEX IF EXISTS idx_absen_wbp_hari;
DROP INDEX IF EXISTS idx_absen_wbp_hari_shift;
DROP INDEX IF EXISTS idx_sesi_aktif;
DROP INDEX IF EXISTS idx_sesi_aktif_shift;

CREATE UNIQUE INDEX IF NOT EXISTS idx_absen_wbp_hari_shift 
  ON absen_detail(wbp_id, tanggal, shift);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sesi_aktif_shift 
  ON absen_session(blok_id, tanggal, shift) WHERE selesai = false;

-- ── STEP 7: Tutup sesi lama ─────────────────────────────────
UPDATE absen_session SET selesai = true WHERE tanggal < CURRENT_DATE;

-- ── STEP 8: Verifikasi final ─────────────────────────────────
SELECT 
  'pegawai' as tabel,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'pegawai'
  AND column_name IN ('is_admin','role','status')
UNION ALL
SELECT 
  'absen_detail',
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'absen_detail'
  AND column_name IN ('shift','status');
